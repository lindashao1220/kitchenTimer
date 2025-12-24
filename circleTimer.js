class CircleTimer {
  constructor(duration, x, y, radius, color) {
    this.duration = duration * 1000;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.startTime = null;
    this.isRunning = false;
    this.isComplete = false;
    this.completionTime = null;

    this.bgColor = [200, 200, 200];
    if (color && color.length >= 3) {
      this.fillColor = [color[0], color[1], color[2]];
    } else {
      this.fillColor = [90, 100, 22, 128];
    }
    this.strokeColor = [255];
    
    this.metaballCount = 12;
    this.g = createGraphics(width, height, WEBGL);
    this.g.noStroke();
    this.g.pixelDensity(1);
    this.metaballShader = this.g.createShader(this.metaballVert(), this.metaballFrag());
    this.g.shader(this.metaballShader);
    this.metaballs = [];
    this.metaballColors = [];
    const baseHueOffset = random(0, 360);
    
    for (let i = 0; i < this.metaballCount; i++) {
      const baseSize = random(0.3, 0.6);
      this.metaballs.push({
        pos: createVector(this.x, this.y),
        vel: p5.Vector.random2D().mult(random(1, 3)),
        baseRadius: this.radius * baseSize
      });
      
      let h = (baseHueOffset + map(i, 0, this.metaballCount, 0, 360) + random(-30, 30)) % 360;
      let s = random(0.4, 0.6);
      let b = random(0.9, 1.0);
      
      let c = b * s;
      let x_col = c * (1 - Math.abs((h / 60) % 2 - 1));
      let m = b - c;
      
      let r, g, bl;
      if (h < 60) { r = c; g = x_col; bl = 0; }
      else if (h < 120) { r = x_col; g = c; bl = 0; }
      else if (h < 180) { r = 0; g = c; bl = x_col; }
      else if (h < 240) { r = 0; g = x_col; bl = c; }
      else if (h < 300) { r = x_col; g = 0; bl = c; }
      else { r = c; g = 0; bl = x_col; }
      
      this.metaballColors.push([
        (r + m) * 255,
        (g + m) * 255,
        (bl + m) * 255
      ]);
    }
    this.neonLayers = 5;
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

    if (!this.isComplete) {
        const elapsed = millis() - this.startTime;
        if (elapsed >= this.duration) {
          this.isComplete = true;
          if (this.completionTime === null) {
            this.completionTime = millis();
          }
        }
    }
  }

  getProgress() {
    if (!this.startTime) return 0;
    const elapsed = millis() - this.startTime;
    return elapsed / this.duration;
  }

  draw() {
    if (!this.isComplete) {
        noFill();
        stroke(this.strokeColor);
        strokeWeight(2);
        circle(this.x, this.y, this.radius * 2);
    }

    let progress = this.getProgress();
    let globalAlpha = 1.0;
    let currentRadius = this.radius;
    let blobAddSize = 0;
    
    if (this.isComplete) {
      const expandElapsed = this.completionTime ? millis() - this.completionTime : 0;
      
      // "the whole screen will be 100 sec"
      // Map 100 seconds of expansion to reach the screen corners from the starting radius
      const expandSeconds = expandElapsed / 1000.0;
      const targetTime = 100.0;
      const maxCorner = dist(width/2, height/2, 0, 0);
      
      // Linearly interpolate growth such that at 100s, currentRadius = maxCorner
      let growth = 0;
      if (targetTime > 0) {
        growth = (expandSeconds / targetTime) * (maxCorner - this.radius);
      }

      currentRadius = this.radius + growth;

      progress = 1.0 + (expandSeconds / targetTime);
      // Scale metaballs proportionally to fill the expanding space
      blobAddSize = growth * 0.8;

    } else {
        progress = constrain(progress, 0, 1);
    }

    this.renderMetaballs(progress, globalAlpha, currentRadius, blobAddSize);

    push();
    imageMode(CORNER);
    image(this.g, 0, 0);
    pop();
  }

  renderMetaballs(progress, globalAlpha = 1.0, currentRadius, blobAddSize = 0) {
    const g = this.g;
    if (progress <= 0) {
      g.clear();
      return;
    }

    const data = [];
    const w = g.width;
    const h = g.height;

    for (let mb of this.metaballs) {
      mb.pos.add(mb.vel);

      let boundR = currentRadius;
      let minX = this.x - boundR;
      let maxX = this.x + boundR;
      let minY = this.y - boundR;
      let maxY = this.y + boundR;

      if (mb.pos.x < minX || mb.pos.x > maxX) mb.vel.x *= -1;
      if (mb.pos.y < minY || mb.pos.y > maxY) mb.vel.y *= -1;

      const r = mb.baseRadius * progress + blobAddSize;
      data.push(mb.pos.x, mb.pos.y, r);
    }

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
      this.metaballShader.setUniform("uCenter", [this.x, this.y]);
      this.metaballShader.setUniform("uRadius", currentRadius);
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

      float random (vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
      }

      void main() {
        float x = vTexCoord.x * uResolution.x;
        float y = vTexCoord.y * uResolution.y;

        if (distance(vec2(x, y), uCenter) > uRadius) {
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
    `;
  }
}
