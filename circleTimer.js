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
    
    // Track if we have resized for the "Beyond" phase
    this.resizedForBeyond = false;

    // Color Palette: Electric Blue, Violet, Cyan
    // Electric Blue: [0, 125, 255]
    // Violet: [180, 50, 255]
    // Cyan: [0, 255, 255]
    this.palette = [
        [0, 125, 255],   // Electric Blue
        [180, 50, 255],  // Violet
        [0, 255, 255]    // Cyan
    ];

    // Setup basic fill/stroke (mostly for the outer ring)
    // We'll use Electric Blue for the ring
    this.strokeColor = [0, 125, 255]; 
    
    // Metaball shader setup (offscreen WEBGL buffer so UI stays 2D)
    this.metaballCount = 12;
    this.g = createGraphics(this.radius * 2, this.radius * 2, WEBGL);
    this.g.noStroke();
    this.g.pixelDensity(1);
    this.metaballShader = this.g.createShader(this.metaballVert(), this.metaballFrag());
    this.g.shader(this.metaballShader);
    this.metaballs = [];
    this.metaballColors = [];
    
    for (let i = 0; i < this.metaballCount; i++) {
      const baseSize = random(0.3, 0.6);
      this.metaballs.push({
        pos: createVector(this.g.width / 2, this.g.height / 2),
        // random velocity
        vel: p5.Vector.random2D().mult(random(1, 3)),
        baseRadius: this.radius * baseSize
      });
      
      // Assign color from palette cyclically or randomly
      // Cycling ensures even distribution
      let col = this.palette[i % this.palette.length];
      this.metaballColors.push(col);
    }
    
    // Number of overlapping layers - reduced slightly to avoid over-saturation
    this.neonLayers = 3;
    // Blob alpha transparency
    this.blobAlpha = 0.8; 
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
      // Handle resizing of buffer once
      if (!this.resizedForBeyond) {
        let oldW = this.g.width;
        let oldH = this.g.height;
        
        // Remove old buffer if possible (optional but good for memory)
        if (this.g.remove) {
             this.g.remove();
        }
        
        // Create new full-screen buffer
        // Note: 'width' and 'height' are p5 global variables for canvas size
        this.g = createGraphics(width, height, WEBGL);
        this.g.noStroke();
        this.g.pixelDensity(1);
        
        // Re-create and assign shader for the new context
        this.metaballShader = this.g.createShader(this.metaballVert(), this.metaballFrag());
        this.g.shader(this.metaballShader);
        
        this.resizedForBeyond = true;
        
        // Shift metaballs to new center
        let newW = this.g.width;
        let newH = this.g.height;
        let shiftX = (newW - oldW) / 2;
        let shiftY = (newH - oldH) / 2;
        
        for (let mb of this.metaballs) {
          mb.pos.add(shiftX, shiftY);
        }
      }

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
      // let maxR = max(width, height);
      // renderRadius = lerp(this.radius, maxR, t);
      // Update: Keep renderRadius fixed to original radius so the container
      // appears to dissolve while blobs grow out (handled in shader)
      renderRadius = this.radius;
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

    this.renderMetaballs(progress, globalAlpha, fuzziness, renderRadius);
    imageMode(CENTER);
    image(this.g, this.x, this.y);
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
    
    for (let mb of this.metaballs) {
      mb.pos.add(mb.vel);
      // Boundary check needs to respect the buffer size
      if (mb.pos.x < mb.baseRadius || mb.pos.x > w - mb.baseRadius) mb.vel.x *= -1;
      if (mb.pos.y < mb.baseRadius || mb.pos.y > h - mb.baseRadius) mb.vel.y *= -1;

      const r = mb.baseRadius * p;
      data.push(mb.pos.x, mb.pos.y, r);
    }

    // Clear and render multiple overlapping layers
    g.clear();
    // Blend mode BLEND works well for gradients on white if we use alpha correctly
    g.blendMode(BLEND); 
    
    const flatColors = [];
    for(let c of this.metaballColors) {
      flatColors.push(c[0]/255, c[1]/255, c[2]/255);
    }

    // Pass the palette colors to the shader
    this.metaballShader.setUniform("uResolution", [w, h]);
    this.metaballShader.setUniform("metaballs", data);
    this.metaballShader.setUniform("metaballColors", flatColors);
    this.metaballShader.setUniform("uThreshold", 1.0);
    this.metaballShader.setUniform("uCenter", [w * 0.5, h * 0.5]);
    this.metaballShader.setUniform("uRadius", currentRadius);
    this.metaballShader.setUniform("uFuzziness", fuzziness);
    
    // We can use uAlphaScalar to control global opacity
    this.metaballShader.setUniform("uAlphaScalar", this.blobAlpha * globalAlpha);

    g.shader(this.metaballShader);
    g.rectMode(CENTER);
    g.noStroke();
    g.rect(0, 0, w, h);
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
      uniform float uThreshold;
      uniform vec2 uCenter;
      uniform float uRadius;
      uniform float uFuzziness;
      uniform float uAlphaScalar;

      float random (vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
      }

      void main() {
        float x = vTexCoord.x * uResolution.x;
        float y = vTexCoord.y * uResolution.y;
        vec2 st = vec2(x, y);

        // --- MASK LOGIC ---
        float distCenter = distance(st, uCenter);

        // Calculate dynamic mask radius
        // When uFuzziness (t) is 0, limit is uRadius.
        // As t increases, limit expands to cover screen.
        float maxDimension = max(uResolution.x, uResolution.y);
        // Expansion logic:
        // We want the mask to open up.
        // pow(uFuzziness, 0.5) makes it start opening quickly then linear-ish
        float t = uFuzziness;
        float expansion = maxDimension * 1.5 * t;

        float currentMaskRadius = uRadius + expansion;

        // Soft mask edge (20px feather)
        float maskAlpha = 1.0 - smoothstep(currentMaskRadius, currentMaskRadius + 20.0, distCenter);

        // Optimization: if fully masked, discard
        if (maskAlpha <= 0.0) discard;

        // --- METABALL CALC ---
        float v = 0.0;
        vec3 accumColor = vec3(0.0);
        float totalWeight = 0.0;
        
        vec2 noisePos = st * 0.05;
        float n = random(noisePos);

        for (int i = 0; i < ${this.metaballCount}; i++) {
          vec3 ball = metaballs[i];
          float dx = ball.x - x;
          float dy = ball.y - y;
          float r = ball.z;
          // Soft diffuse influence function
          // Increase divisor slightly to soften core
          float influence = r * r / (dx * dx + dy * dy + 200.0); 
          v += influence;
          
          accumColor += metaballColors[i] * influence;
          totalWeight += influence;
        }
        
        vec3 blendedColor = accumColor / (totalWeight + 1e-5);
        
        // Base threshold
        float threshold = uThreshold * 0.8;

        // Glass texture: Add subtle white noise modulation
        vec3 texturedColor = mix(blendedColor, vec3(1.0), n * 0.2);

        // --- ALPHA / EDGE LOGIC ---
        // Interpolate between "Normal" (sharp/contained) and "Fuzzy" (soft/cloudy) parameters

        // Normal Mode (t=0):
        // smoothstep(threshold - 0.2, threshold + 0.3, v) -> approx (0.6, 1.1)

        // Fuzzy Mode (t=1):
        // We want it softer. Maybe (0.2, 1.2) or (0.1, 1.5)

        float edgeMin = mix(threshold - 0.2, threshold * 0.2, t);
        float edgeMax = mix(threshold + 0.3, threshold + 0.5, t);

        float alpha = smoothstep(edgeMin, edgeMax, v);

        // Apply global alpha & mask
        alpha = alpha * uAlphaScalar * maskAlpha;

        if (alpha < 0.01) discard;

        // --- RIM LIGHT LOGIC ---
        // Rim light on the ORIGINAL CONTAINER circle
        // It should fade out as we go beyond
        float distRatio = distCenter / uRadius;

        // Only show rim if we are near the original radius
        // And fade it out as t increases
        float edgeGlow = smoothstep(0.85, 1.0, distRatio);

        // Fade out quickly as t increases to avoid a ghost ring
        float rimIntensity = edgeGlow * 0.6 * (1.0 - t * 3.0);
        rimIntensity = max(0.0, rimIntensity);

        vec3 finalColor = mix(texturedColor, vec3(1.0), rimIntensity);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;
  }
}
