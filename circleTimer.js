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
    this.blobAlpha = 0.9;

    // Beyond effect setup
    // Using a separate full-screen buffer for the Beyond effect
    this.beyondG = createGraphics(windowWidth, windowHeight, WEBGL);
    this.beyondG.noStroke();
    this.beyondG.pixelDensity(1);
    this.beyondShader = this.beyondG.createShader(this.beyondVert(), this.beyondFrag());
    this.beyondG.shader(this.beyondShader);
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

  draw() {
    // Draw outer background circle
    noFill();
    stroke(this.strokeColor);
    strokeWeight(2);
    circle(this.x, this.y, this.radius * 2);

    let progress = this.getProgress();
    let globalAlpha = 1.0;
    
    // If timer is complete, trigger the Beyond effect
    if (this.isComplete) {
      // Keep the timer filled (static)
      progress = 1.0;
      globalAlpha = 1.0;
      
      const beyondElapsed = this.completionTime ? millis() - this.completionTime : 0;
      const beyondDuration = 100000; // 100 seconds
      const beyondProgress = constrain(beyondElapsed / beyondDuration, 0, 1);
      
      // Render the Beyond effect (expanding rainbow ring)
      this.renderBeyond(beyondProgress);
    } else {
        // Clear beyond buffer when not complete (optional, to keep it clean)
        this.beyondG.clear();
    }

    // Render metaball-style blob into offscreen buffer, then draw it centered
    this.renderMetaballs(progress, globalAlpha);
    imageMode(CENTER);
    image(this.g, this.x, this.y);

    if (this.isComplete) {
        // Draw the Beyond effect on top of everything, filling the screen
        imageMode(CORNER);
        image(this.beyondG, 0, 0, width, height);

        // Draw "Beyond [X] seconds" text
        const beyondSeconds = Math.floor((millis() - this.completionTime) / 1000);
        fill(255);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(24);
        text(`Beyond ${beyondSeconds} seconds`, width / 2, height / 2);
    }
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
      
      // Add centripetal force if shrinking (kept logic but globalAlpha is 1.0 when complete now)
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

  renderBeyond(progress) {
      const g = this.beyondG;
      g.clear();

      // Calculate growing radius for the ring
      // Start from 0 or small radius and grow to cover the screen
      // Screen diagonal is roughly sqrt(w^2 + h^2)
      // Let's say max radius is larger than screen diagonal to ensure full coverage
      const maxDist = dist(0, 0, width, height) * 1.2;
      const currentR = progress * maxDist;
      const time = millis() * 0.001;

      this.beyondShader.setUniform("uResolution", [width, height]);
      this.beyondShader.setUniform("uRadius", currentR);
      this.beyondShader.setUniform("uCenter", [width / 2, height / 2]);
      this.beyondShader.setUniform("uTime", time);

      // Pass the timer fill color (normalized)
      const color = [this.fillColor[0]/255, this.fillColor[1]/255, this.fillColor[2]/255, 1.0];
      this.beyondShader.setUniform("uColor", color);

      g.rectMode(CENTER);
      g.rect(0, 0, width, height);
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

  beyondVert() {
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

  beyondFrag() {
      return `
        precision highp float;

        varying vec2 vTexCoord;

        uniform vec2 uResolution;
        uniform float uRadius;
        uniform vec2 uCenter;
        uniform float uTime;
        uniform vec4 uColor;

        // Simplex 2D noise
        // Source: https://github.com/stegu/webgl-noise/blob/master/src/noise2D.glsl
        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

        float snoise(vec2 v){
          const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                   -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy) );
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
          + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m ;
          m = m*m ;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
            vec2 uv = (vTexCoord - 0.5) * uResolution;

            float len = length(uv);
            float angle = atan(uv.y, uv.x);

            float noiseScale = 0.005;
            float timeScale = uTime * 0.5;

            // Create fluid distortion using noise
            float n = snoise(uv * noiseScale + vec2(timeScale, timeScale));
            float distortion = n * 50.0;

            float distToRing = abs(len - uRadius + distortion);
            float thickness = 40.0 + 20.0 * sin(uTime * 2.0 + angle * 3.0);

            if (distToRing < thickness) {
                // Interior of the blob/ring

                // Color mixing for pastel rainbow effect
                float noiseVal = snoise(uv * 0.005 - vec2(timeScale * 0.5));

                // Hue varies with angle and noise (0.0 to 1.0)
                // Normalize angle (-PI to PI) to 0-1
                float hue = fract(angle / 6.28 + uTime * 0.1 + noiseVal * 0.5);

                // Pastel color: Saturation ~0.5, Brightness ~0.9
                vec3 col = hsv2rgb(vec3(hue, 0.5, 0.95));

                // Alpha falloff
                float alpha = 1.0 - smoothstep(thickness * 0.7, thickness, distToRing);

                gl_FragColor = vec4(col, alpha * 0.8);
            } else {
                gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            }
        }
      `;
  }
}
