// Global configuration for metaballs
const METABALL_CONFIG = {
  // Array of RGB colors [r, g, b]
  colors: [
    [0, 128, 255],   // Electric Blue
    [127, 0, 255],   // Violet
    [0, 255, 255],   // Cyan
    [0, 200, 255],   // Light Blue
    [100, 50, 255]   // Indigo
  ],
  baseAlpha: 0.9,
  neonLayers: 5
};

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

    // Use configured colors
    const palette = METABALL_CONFIG.colors;
    
    for (let i = 0; i < this.metaballCount; i++) {
      const baseSize = random(0.3, 0.6);
      this.metaballs.push({
        // Initialize positions at the timer's center (this.x, this.y)
        pos: createVector(this.x, this.y),
        // random velocity
        vel: p5.Vector.random2D().mult(random(1, 3)),
        baseRadius: this.radius * baseSize
      });
      
      // Select color from palette or interpolate
      let colorIndex = i % palette.length;
      let c = palette[colorIndex];
      // Add slight variation
      let varR = constrain(c[0] + random(-20, 20), 0, 255);
      let varG = constrain(c[1] + random(-20, 20), 0, 255);
      let varB = constrain(c[2] + random(-20, 20), 0, 255);
      
      this.metaballColors.push([varR, varG, varB]);
    }
    // Number of overlapping layers for neon glow effect
    this.neonLayers = METABALL_CONFIG.neonLayers;
    // Blob alpha transparency (0.0 = transparent, 1.0 = opaque)
    this.blobAlpha = METABALL_CONFIG.baseAlpha;
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
      let tLinear = constrain(beyondElapsed / growDuration, 0, 1);

      // Use smoothstep for t to make the start of the transition non-linear (slow acceleration)
      const t = tLinear * tLinear * (3 - 2 * tLinear);
      
      // Progress stays 1.0 (full size metaballs)
      progress = 1.0;
      
      // Fuzziness increases
      fuzziness = t;
      
      // Radius expands smoothly
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

    this.renderMetaballs(progress, globalAlpha, fuzziness, renderRadius);
    
    // Draw the full-screen buffer aligned with the canvas
    imageMode(CENTER);
    image(this.g, width / 2, height / 2);
  }

  renderMetaballs(progress, globalAlpha = 1.0, fuzziness = 0.0, renderRadius = null) {
    const g = this.g;
    // Only constrain if not in fuzzy/growth mode
    let p = progress;

    // In "Beyond" mode (fuzziness > 0), we want the particles to move freely but constrained by the growing radius
    // We do NOT want to constrain p to 1 because p is used to scale the metaball radius (size)
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
    let minX, maxX, minY, maxY;

    if (fuzziness > 0) {
        // In "Beyond" mode: Bounds transition from initial Radius (square) to Screen Size (rect)
        // Transition based on fuzziness (t)

        // Initial bounds (centered square)
        const r = this.radius;
        const startMinX = this.x - r;
        const startMaxX = this.x + r;
        const startMinY = this.y - r;
        const startMaxY = this.y + r;

        // Target bounds (full screen)
        const endMinX = 0;
        const endMaxX = w;
        const endMinY = 0;
        const endMaxY = h;

        // Interpolate
        minX = lerp(startMinX, endMinX, fuzziness);
        maxX = lerp(startMaxX, endMaxX, fuzziness);
        minY = lerp(startMinY, endMinY, fuzziness);
        maxY = lerp(startMaxY, endMaxY, fuzziness);

    } else {
        // Normal mode: Bounds are centered square defined by radius
        const r = currentRadius;
        minX = this.x - r;
        maxX = this.x + r;
        minY = this.y - r;
        maxY = this.y + r;
    }

    for (let mb of this.metaballs) {
      
      mb.pos.add(mb.vel);
      
      // Bounce off the calculated bounds
      // Constrain particles to the calculated bounds
      if (mb.pos.x < minX + mb.baseRadius || mb.pos.x > maxX - mb.baseRadius) {
          mb.vel.x *= -1;
          mb.pos.x = constrain(mb.pos.x, minX + mb.baseRadius, maxX - mb.baseRadius);
      }
      if (mb.pos.y < minY + mb.baseRadius || mb.pos.y > maxY - mb.baseRadius) {
          mb.vel.y *= -1;
          mb.pos.y = constrain(mb.pos.y, minY + mb.baseRadius, maxY - mb.baseRadius);
      }

      // The radius of the metaball
      const metaballRadius = mb.baseRadius * p;
      data.push(mb.pos.x, mb.pos.y, metaballRadius);
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

        // Container soft clip
        // Use uRadius to define the visible area.
        // We use a smoothstep to create a soft edge, preventing harsh discard.
        float dist = distance(vec2(x, y), uCenter);
        float containerAlpha = 1.0 - smoothstep(uRadius - 1.0, uRadius + 1.0, dist);

        if (containerAlpha <= 0.0) {
            discard;
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

        // Smoothly interpolate parameters based on uFuzziness

        // Lower bound: where alpha starts to become > 0
        // Normal mode (Fuzz=0): threshold
        // Fuzzy mode (Fuzz=1): threshold * 0.05 (much wider spread)
        float lowerBound = mix(threshold, threshold * 0.05, uFuzziness);

        // Upper bound: where alpha becomes 1.0
        // Normal mode (Fuzz=0): threshold + epsilon (sharp edge)
        // Fuzzy mode (Fuzz=1): threshold + 0.2 (soft edge)
        float upperBound = mix(threshold + 0.5, threshold + 0.2, uFuzziness);

        // For sharp edge in normal mode, we need step-like behavior, but smoothstep handles it if range is small
        // In normal mode: smoothstep(threshold, threshold + 0.5, v)

        float alpha = smoothstep(lowerBound, upperBound, v);

        // Edge glow calculation (only for normal mode really, but let's see)
        float distFromCenter = distance(vec2(x, y), uCenter) / uRadius;
        float edgeGlow = 1.0 - smoothstep(0.7, 1.0, distFromCenter);

        // Reduce edge glow influence as we get fuzzy
        float glowInfluence = mix(0.6 + 0.4 * edgeGlow, 1.0, uFuzziness);

        // Combine all alphas: blob alpha * edge glow * container soft clip
        float finalAlpha = uColor.a * alpha * glowInfluence * containerAlpha;

        if (finalAlpha < 0.01) {
            // Discard purely transparent pixels to save fill rate?
            // Or just output 0
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        } else {
            vec3 finalColor = blendedColor * (0.95 + 0.1 * n);
            gl_FragColor = vec4(finalColor, finalAlpha);
        }
      }
    `;
  }
}
