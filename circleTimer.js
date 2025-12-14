class CircleTimer {
  constructor(duration, x, y, radius, color) {
    this.duration = duration * 1000;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.startTime = null;
    this.isRunning = false;
    this.isComplete = false;
    this.completionTime = null; // track when the timer finished for shrink-out

    // Color & style
    this.bgColor = [200, 200, 200];
    // Set fill color with 50% transparency (alpha = 128)
    if (color && color.length >= 3) {
      this.fillColor = [color[0], color[1], color[2]];
    } else {
      this.fillColor = [90, 100, 22, 128];
    }
    this.strokeColor = [255];
    
    // Metaball shader setup (offscreen WEBGL buffer so UI stays 2D)
    this.metaballCount = 12;
    this.g = createGraphics(this.radius * 2, this.radius * 2, WEBGL);
    this.g.noStroke();
    this.g.pixelDensity(1);
    this.metaballShader = this.g.createShader(this.metaballVert(), this.metaballFrag());
    this.g.shader(this.metaballShader);
    this.metaballs = [];
    // Store color variations for each metaball for watercolor effect
    this.metaballColors = [];
    // Generate a base hue offset for this timer instance
    const baseHueOffset = random(0, 360);
    
    for (let i = 0; i < this.metaballCount; i++) {
      const baseSize = random(0.3, 0.6);
      this.metaballs.push({
        pos: createVector(this.g.width / 2, this.g.height / 2),
        // random velocity
        vel: p5.Vector.random2D().mult(random(1, 3)),
        baseRadius: this.radius * baseSize
      });
      
      // Generate soft multicolor pastel palette
      // Using HSB-like logic but converting to RGB manually
      // Hue: distributed around the circle or random
      // Saturation: Low-Medium (to be pastel) ~ 0.4-0.6
      // Brightness: High ~ 0.8-1.0
      
      let h = (baseHueOffset + map(i, 0, this.metaballCount, 0, 360) + random(-30, 30)) % 360;
      let s = random(0.4, 0.6);
      let b = random(0.9, 1.0);
      
      // HSB to RGB conversion
      let c = b * s;
      let x = c * (1 - Math.abs((h / 60) % 2 - 1));
      let m = b - c;
      
      let r, g, bl;
      if (h < 60) { r = c; g = x; bl = 0; }
      else if (h < 120) { r = x; g = c; bl = 0; }
      else if (h < 180) { r = 0; g = c; bl = x; }
      else if (h < 240) { r = 0; g = x; bl = c; }
      else if (h < 300) { r = x; g = 0; bl = c; }
      else { r = c; g = 0; bl = x; }
      
      this.metaballColors.push([
        (r + m) * 255,
        (g + m) * 255,
        (bl + m) * 255
      ]);
    }
    // Number of overlapping layers for neon glow effect
    this.neonLayers = 5;
    // Blob alpha transparency (0.0 = transparent, 1.0 = opaque)
    this.blobAlpha = 0.3;
  }

  start() {
    this.startTime = millis();
    this.isRunning = true;
    this.isComplete = false;
  }

  reset() {
    this.startTime = null;
    this.isRunning = false;
    this.isComplete = false;
  }

  update() {
    if (!this.isRunning || !this.startTime) return;
    const elapsed = millis() - this.startTime;
    if (elapsed >= this.duration) {
      this.isComplete = true;
      this.isRunning = false;
      if (this.completionTime === null) {
        this.completionTime = millis();
      }
    }
  }

  getProgress() {
    if (!this.startTime) return 0;
    const elapsed = millis() - this.startTime;
    return constrain(elapsed / this.duration, 0, 1);
  }

  // 多阶 noise 合成
  layeredNoise(nx, ny, time) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let total = 0;
    for (let i = 0; i < this.blobLayers; i++) {
      sum += noise(nx*freq, ny*freq, time*freq) * amp;
      total += amp;
      amp *= this.blobLayerAmp;
      freq *= 2;
    }
    return sum / total;
  }

  draw() {
    // Draw outer background circle
    noFill();
    stroke(this.strokeColor);
    strokeWeight(2);
    circle(this.x, this.y, this.radius * 2);

    let progress = this.getProgress();
    let globalAlpha = 1.0;
    
    // If timer is complete, shrink the filled circle over 10 seconds
    if (this.isComplete) {
      const shrinkElapsed = this.completionTime ? millis() - this.completionTime : 0;
      const shrinkDuration = 10000;
      const shrinkT = constrain(shrinkElapsed / shrinkDuration, 0, 1);
      
      // Calculate display progress for shrink (1.0 -> 0.0)
      progress = 1.0 - shrinkT;
      
      // Fade out effect
      globalAlpha = 1.0 - shrinkT;

      if (shrinkT >= 1.0) {
        this.g.clear();
        return; // fully shrunk
      }
    }

    // Render metaball-style blob into offscreen buffer, then draw it centered
    this.renderMetaballs(progress, globalAlpha);
    imageMode(CENTER);
    image(this.g, this.x, this.y);
  }

  renderMetaballs(progress, globalAlpha = 1.0) {
    const g = this.g;
    const p = constrain(progress, 0, 1);
    if (p <= 0) {
      g.clear();
      return;
    }

    // Update metaball positions and pack uniforms
    const data = [];
    const w = g.width;
    const h = g.height;
    const center = createVector(w / 2, h / 2);

    for (let mb of this.metaballs) {
      
      // Add centripetal force if shrinking
      if (globalAlpha < 1.0) {
        let dir = p5.Vector.sub(center, mb.pos);
        dir.normalize();
        dir.mult(0.5); // Attraction strength
        mb.vel.add(dir);
        mb.vel.limit(3); 
      }

      mb.pos.add(mb.vel);
      if (mb.pos.x < mb.baseRadius || mb.pos.x > w - mb.baseRadius) mb.vel.x *= -1;
      if (mb.pos.y < mb.baseRadius || mb.pos.y > h - mb.baseRadius) mb.vel.y *= -1;

      const r = mb.baseRadius * p;
      data.push(mb.pos.x, mb.pos.y, r);
    }

    // Clear and render multiple overlapping layers for neon glow effect
    g.clear();
    g.blendMode(BLEND); // Normal blending with low alpha for neon effect
    
    // Render multiple layers with slight color variations and low alpha
    const time = millis() * 0.001; // Time-based variation for subtle animation
    for (let layer = 0; layer < this.neonLayers; layer++) {
      // Create color variation for this layer using time and layer index
      // This creates smooth, consistent variations without flickering
      // Similar to reference code's random(-25,25) but time-based
      const colorVar = sin(time * 0.5 + layer * 0.7) * 25 + cos(time * 0.3 + layer) * 15;
      
      // Apply globalAlpha to the layer alpha
      const currentAlpha = this.blobAlpha * globalAlpha;
      
      const layerColor = [
        constrain(this.fillColor[0] + colorVar, 0, 255) / 255,
        constrain(this.fillColor[1] + colorVar * 0.8, 0, 255) / 255,
        constrain(this.fillColor[2] + colorVar * 1.2, 0, 255) / 255,
        currentAlpha
      ];

      g.shader(this.metaballShader);
      // Flatten and normalize metaball colors
      const flatColors = [];
      for(let c of this.metaballColors) {
        flatColors.push(c[0]/255, c[1]/255, c[2]/255);
      }

      this.metaballShader.setUniform("uResolution", [w, h]);
      this.metaballShader.setUniform("metaballs", data);
      this.metaballShader.setUniform("metaballColors", flatColors);
      this.metaballShader.setUniform("uColor", layerColor);
      this.metaballShader.setUniform("uThreshold", 1.0);
      this.metaballShader.setUniform("uCenter", [w * 0.5, h * 0.5]);
      this.metaballShader.setUniform("uRadius", this.radius);
      g.rectMode(CENTER);
      g.noStroke();
      g.rect(0, 0, w, h);
    }
  }

  metaballVert() {
    return `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      void main() {
        vTexCoord = aTexCoord;
        vec4 positionVec4 = vec4(aPosition, 1.0);
        positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
        gl_Position = positionVec4;
      }
    `;
  }

  metaballFrag() {
    return `
      precision highp float;
      varying vec2 vTexCoord;
      uniform vec3 metaballs[${this.metaballCount}];
      uniform vec3 metaballColors[${this.metaballCount}];
      uniform vec2 uResolution;
      uniform vec4 uColor;
      uniform float uThreshold;
      uniform vec2 uCenter;
      uniform float uRadius;

      // Simple noise function for texture
      float random (vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
      }

      void main() {
        float x = vTexCoord.x * uResolution.x;
        float y = vTexCoord.y * uResolution.y;

        // Mask: only draw inside the circle radius
        if (distance(vec2(x, y), uCenter) > uRadius) {
          discard;
        }

        float v = 0.0;
        vec3 accumColor = vec3(0.0);
        float totalWeight = 0.0;
        
        // Watercolor diffusion: add noise to position lookup or texture
        vec2 noisePos = vec2(x, y) * 0.05; // Scale for noise texture
        float n = random(noisePos);

        for (int i = 0; i < ${this.metaballCount}; i++) {
          vec3 ball = metaballs[i];
          float dx = ball.x - x;
          float dy = ball.y - y;
          float r = ball.z;
          float influence = r * r / (dx * dx + dy * dy + 1e-5);
          v += influence;
          
          accumColor += metaballColors[i] * influence;
          totalWeight += influence;
        }
        
        vec3 blendedColor = accumColor / (totalWeight + 1e-5);
        
        // Add some noise to the threshold for "watercolor" paper/bleeding effect
        // Modulate threshold slightly with noise to create irregular edges
        float threshold = uThreshold * 0.8 + (n - 0.5) * 0.1;

        if (v >= threshold) {
          float distFromCenter = distance(vec2(x, y), uCenter) / uRadius;
          float edgeGlow = 1.0 - smoothstep(0.7, 1.0, distFromCenter);
          
          // Soften the alpha based on field strength v (simulating watercolor accumulation)
          float alphaStrength = smoothstep(threshold, threshold + 0.5, v);
          
          // Use uColor.a as the base alpha control from the JS side
          float finalAlpha = uColor.a * alphaStrength * (0.6 + 0.4 * edgeGlow);
          
          // Slight color modulation with noise for texture
          vec3 finalColor = blendedColor * (0.95 + 0.1 * n);
          
          gl_FragColor = vec4(finalColor, finalAlpha);
        } else {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      }
    `;
  }
}