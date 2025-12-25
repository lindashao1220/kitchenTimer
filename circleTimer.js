class CircleTimer {
  constructor(duration, beyondDurationMinutes, x, y, radius, color) {
    this.duration = duration * 1000;
    this.beyondDuration = (beyondDurationMinutes || 1) * 60 * 1000;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.startTime = null;
    this.isRunning = false;
    this.isComplete = false;
    this.completionTime = null; 
    
    // Color & style
    this.bgColor = [200, 200, 200];
    // Set fill color with 50% transparency (alpha = 128)
    if (color && color.length >= 3) {
      this.fillColor = [color[0], color[1], color[2]];
    } else {
      this.fillColor = [90, 100, 22, 128];
    }
    this.strokeColor = [255];
    
    // Metaball shader setup (full-screen WEBGL buffer)
    this.metaballCount = 12;
    // Use full canvas size for the buffer to allow seamless expansion
    this.g = createGraphics(width, height, WEBGL);
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
        // Initialize positions at the timer's center (this.x, this.y)
        pos: createVector(this.x, this.y),
        // random velocity
        vel: p5.Vector.random2D().mult(random(1, 3)),
        baseRadius: this.radius * baseSize
      });
      
      let h = (baseHueOffset + map(i, 0, this.metaballCount, 0, 360) + random(-30, 30)) % 360;
      let s = random(0.4, 0.6);
      let b = random(0.9, 1.0);
      
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
    if (!this.isComplete) {
      noFill();
      stroke(this.strokeColor);
      strokeWeight(2);
      circle(this.x, this.y, this.radius * 2);
    }

    let progress = this.getProgress();
    let globalAlpha = 1.0;
    let fuzziness = 0.0;
    let renderRadius = this.radius;
    
    // "Beyond" logic: Grow and become fuzzy instead of shrinking
    if (this.isComplete) {
      const beyondElapsed = this.completionTime ? millis() - this.completionTime : 0;
      // "Slowly growing"
      // Use the configured beyondDuration for the growth speed
      const growDuration = this.beyondDuration;
      const t = constrain(beyondElapsed / growDuration, 0, 1);
      
      // Progress stays 1.0 (full size metaballs)
      progress = 1.0;
      
      // Fuzziness increases
      fuzziness = t;
      
      // Radius grows linearly or smoothly
      let maxR = max(width, height);
      renderRadius = lerp(this.radius, maxR, t);
    }

    // Render metaball-style blob into offscreen buffer, then draw it centered
    if (this.isComplete) {
        // Calculate growth scale for metaballs
        // We want them to grow to fill the screen visually
        let maxR = max(width, height); 
        let growthRatio = maxR / (this.radius > 1 ? this.radius : 1);
        // Animate scale from 1.0 to growthRatio over the duration (captured by fuzziness t)
        progress = lerp(1.0, growthRatio, fuzziness);
    }

    // Adjust fuzziness for rendering to keep blobs solid (not too blurry)
    // We scale it down significantly so the shader keeps edges sharper
    let visualFuzziness = fuzziness;
    if (this.isComplete) {
        visualFuzziness = fuzziness * 0.15;
    }

    this.renderMetaballs(progress, globalAlpha, visualFuzziness, renderRadius);
    
    // Draw the full-screen buffer aligned with the canvas
    imageMode(CENTER);
    image(this.g, width / 2, height / 2);
  }

  renderMetaballs(progress, globalAlpha = 1.0, fuzziness = 0.0, renderRadius = null) {
    const g = this.g;
    // Only constrain if not in fuzzy/growth mode
    let p = progress;
    if (fuzziness === 0) {
        p = constrain(progress, 0, 1);
    }
    
    if (p <= 0 && fuzziness === 0) {
      g.clear();
      return;
    }

    const currentRadius = renderRadius !== null ? renderRadius : this.radius;

    // Update metaball positions and pack uniforms
    const data = [];
    const w = g.width;
    const h = g.height;
    
    // Determine bounds for metaballs
    let minX = 0;
    let maxX = w;
    let minY = 0;
    let maxY = h;

    // If we are NOT in the "Beyond" expansion phase, constrain particles to the timer radius
    // This mimics the previous behavior where they bounced inside the small buffer
    if (!this.isComplete && fuzziness === 0) {
        // Use the current radius (or base radius) to define a bounding box around the center
        // The previous code had a buffer of size radius*2, effectively constraining to radius.
        const r = this.radius;
        minX = this.x - r;
        maxX = this.x + r;
        minY = this.y - r;
        maxY = this.y + r;
    }

    for (let mb of this.metaballs) {
      
      // Slow motion effect when complete (15% of original speed)
      if (this.isComplete) {
        mb.pos.add(p5.Vector.mult(mb.vel, 0.15));
      } else {
        mb.pos.add(mb.vel);
      }
      
      // Bounce off the calculated bounds
      if (mb.pos.x < minX + mb.baseRadius || mb.pos.x > maxX - mb.baseRadius) {
          mb.vel.x *= -1;
          // Constrain to ensure they don't get stuck outside if bounds shrink (though bounds only grow here)
          mb.pos.x = constrain(mb.pos.x, minX + mb.baseRadius, maxX - mb.baseRadius);
      }
      if (mb.pos.y < minY + mb.baseRadius || mb.pos.y > maxY - mb.baseRadius) {
          mb.vel.y *= -1;
          mb.pos.y = constrain(mb.pos.y, minY + mb.baseRadius, maxY - mb.baseRadius);
      }

      const r = mb.baseRadius * p;
      data.push(mb.pos.x, mb.pos.y, r);
    }

    // Clear and render multiple overlapping layers for neon glow effect
    g.clear();
    g.blendMode(BLEND); 
    
    const time = millis() * 0.001; 
    for (let layer = 0; layer < this.neonLayers; layer++) {
      const colorVar = sin(time * 0.5 + layer * 0.7) * 25 + cos(time * 0.3 + layer) * 15;
      const currentAlpha = this.blobAlpha * globalAlpha;
      
      const layerColor = [
        constrain(this.fillColor[0] + colorVar, 0, 255) / 255,
        constrain(this.fillColor[1] + colorVar * 0.8, 0, 255) / 255,
        constrain(this.fillColor[2] + colorVar * 1.2, 0, 255) / 255,
        currentAlpha
      ];

      g.shader(this.metaballShader);
      const flatColors = [];
      for(let c of this.metaballColors) {
        flatColors.push(c[0]/255, c[1]/255, c[2]/255);
      }

      this.metaballShader.setUniform("uResolution", [w, h]);
      this.metaballShader.setUniform("metaballs", data);
      this.metaballShader.setUniform("metaballColors", flatColors);
      this.metaballShader.setUniform("uColor", layerColor);
      this.metaballShader.setUniform("uThreshold", 1.0);
      // Use the actual position as the center, since the buffer is full screen
      this.metaballShader.setUniform("uCenter", [this.x, this.y]);
      this.metaballShader.setUniform("uRadius", currentRadius);
      this.metaballShader.setUniform("uFuzziness", fuzziness);
      
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
      uniform float uFuzziness;

      float random (vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
      }

      void main() {
        float x = vTexCoord.x * uResolution.x;
        float y = vTexCoord.y * uResolution.y;

        // Hard clipping at outer radius, but allow growth
        // Disable clipping when in fuzzy "Beyond" mode to allow organic growth
        if (uFuzziness <= 0.0) {
          if (distance(vec2(x, y), uCenter) > uRadius) {
            discard;
          }
        }

        float v = 0.0;
        vec3 accumColor = vec3(0.0);
        float totalWeight = 0.0;
        
        vec2 noisePos = vec2(x, y) * 0.05; 
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
        
        float threshold = uThreshold * 0.8 + (n - 0.5) * 0.1;

        if (uFuzziness > 0.0) {
            // Fuzzy mode
            // Map v to alpha smoothly
            // As uFuzziness increases, we want to see lower v values (softer edges)
            // When uFuzziness is 1.0, we might want visible alpha down to v ~ 0.1
            
            float lowerBound = threshold * (1.0 - uFuzziness * 0.95);
            float upperBound = threshold + (uFuzziness * 0.2); 
            
            float alpha = smoothstep(lowerBound, upperBound, v);
            
            // Texture
            vec3 finalColor = blendedColor * (0.95 + 0.1 * n);
            
            gl_FragColor = vec4(finalColor, alpha * uColor.a);
            
        } else {
            // Normal mode
            if (v >= threshold) {
              float distFromCenter = distance(vec2(x, y), uCenter) / uRadius;
              float edgeGlow = 1.0 - smoothstep(0.7, 1.0, distFromCenter);
              
              float alphaStrength = smoothstep(threshold, threshold + 0.5, v);
              float finalAlpha = uColor.a * alphaStrength * (0.6 + 0.4 * edgeGlow);
              vec3 finalColor = blendedColor * (0.95 + 0.1 * n);
              gl_FragColor = vec4(finalColor, finalAlpha);
            } else {
              gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            }
        }
      }
    `;
  }
}
