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
    // Store color variations for each metaball for neon effect
    this.metaballColors = [];
    for (let i = 0; i < this.metaballCount; i++) {
      const baseSize = random(0.3, 0.6);
      this.metaballs.push({
        pos: createVector(this.g.width / 2, this.g.height / 2),
        // random velocity
        vel: p5.Vector.random2D().mult(random(1, 3)),
        baseRadius: this.radius * baseSize
      });
      // Create color variation for each metaball (neon effect)
      const colorVar = random(-30, 30);
      this.metaballColors.push([
        constrain(this.fillColor[0] + colorVar, 0, 255),
        constrain(this.fillColor[1] + colorVar, 0, 255),
        constrain(this.fillColor[2] + colorVar, 0, 255)
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

    const progress = this.getProgress();
    
    // If timer is complete, shrink the filled circle over 10 seconds
    if (this.isComplete) {
      const shrinkElapsed = this.completionTime ? millis() - this.completionTime : 0;
      const shrinkT = constrain(shrinkElapsed / 10000, 0, 1); // 10s shrink duration
      const shrinkRadius = this.radius * (1 - shrinkT);
      if (shrinkRadius <= 0.5) {
        return; // fully shrunk
      }
      noStroke();
      
      // Create radial gradient for soft, blurred effect
      // Outer edge is more transparent (shallower), center is more opaque
      const ctx = drawingContext;
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,                    // Center point (inner circle)
        this.x, this.y, shrinkRadius          // Outer circle
      );
      
      // Get base color - use same as blob (without time variations)
      const baseR = this.fillColor[0] || 90;
      const baseG = this.fillColor[1] || 100;
      const baseB = this.fillColor[2] || 22;
      
      // Calculate effective alpha to match blob's appearance
      // Blob uses 5 layers with 0.08 alpha each in BLEND mode
      // Approximate effective alpha: 1 - (1 - 0.08)^5 ≈ 0.34
      // But for visual matching, we'll use a value that looks similar
      const effectiveAlpha = 0.5; // Matches blob's cumulative alpha effect
      
      // Center: same opacity as blob
      gradient.addColorStop(0, `rgba(${baseR}, ${baseG}, ${baseB}, ${effectiveAlpha})`);
      // Outer edge: very transparent (shallower)
      gradient.addColorStop(1, `rgba(${baseR}, ${baseG}, ${baseB}, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, shrinkRadius, 0, TWO_PI);
      ctx.fill();
      return;
    }

    // Render metaball-style blob into offscreen buffer, then draw it centered
    this.renderMetaballs(progress);
    imageMode(CENTER);
    image(this.g, this.x, this.y);
  }

  renderMetaballs(progress) {
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
    for (let mb of this.metaballs) {
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
      const layerColor = [
        constrain(this.fillColor[0] + colorVar, 0, 255) / 255,
        constrain(this.fillColor[1] + colorVar * 0.8, 0, 255) / 255,
        constrain(this.fillColor[2] + colorVar * 1.2, 0, 255) / 255,
        this.blobAlpha // Alpha for neon glow effect - easily accessible via this.blobAlpha
      ];

      g.shader(this.metaballShader);
      this.metaballShader.setUniform("uResolution", [w, h]);
      this.metaballShader.setUniform("metaballs", data);
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
      uniform vec2 uResolution;
      uniform vec4 uColor;
      uniform float uThreshold;
      uniform vec2 uCenter;
      uniform float uRadius;

      void main() {
        float x = vTexCoord.x * uResolution.x;
        float y = vTexCoord.y * uResolution.y;

        // Mask: only draw inside the circle radius
        if (distance(vec2(x, y), uCenter) > uRadius) {
          discard;
        }

        float v = 0.0;
        for (int i = 0; i < ${this.metaballCount}; i++) {
          vec3 ball = metaballs[i];
          float dx = ball.x - x;
          float dy = ball.y - y;
          float r = ball.z;
          v += r * r / (dx * dx + dy * dy + 1e-5);
        }
        
        // Create smooth falloff for neon glow effect
        float glow = smoothstep(uThreshold * 0.8, uThreshold * 1.2, v);
        
        if (v >= uThreshold * 0.8) {
          // Add glow effect with distance-based intensity
          float distFromCenter = distance(vec2(x, y), uCenter) / uRadius;
          float edgeGlow = 1.0 - smoothstep(0.7, 1.0, distFromCenter);
          float finalAlpha = uColor.a * glow * (0.5 + 0.5 * edgeGlow);
          gl_FragColor = vec4(uColor.rgb, finalAlpha);
        } else {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        }
      }
    `;
  }
}
