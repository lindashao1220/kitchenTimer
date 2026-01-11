// LandingVisuals Class
// Replaces the old LandingBlob class.
// This class manages a set of drifting metaballs that fill the screen,
// using the same visual style (shader) as the CircleTimer.
class LandingVisuals {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    
    // --- Visual Settings ---
    // Same as CircleTimer but maybe with some tweaks if needed.
    this.metaballCount = 12; // Use same count for consistency
    this.neonLayers = 5;
    this.blobAlpha = METABALL_CONFIG.transparency;
    this.fillColor = [90, 100, 22, 128]; // Default base color
    
    // WebGL buffer for shader rendering
    this.g = createGraphics(this.width, this.height, WEBGL);
    this.g.noStroke();
    this.g.pixelDensity(1);
    
    // Helper function to get shader strings should be available globally now
    // if circleTimer.js is loaded.
    this.metaballShader = this.g.createShader(getMetaballVert(), getMetaballFrag(this.metaballCount));
    this.g.shader(this.metaballShader);
    
    this.metaballs = [];
    this.metaballColors = [];
    
    const configColors = METABALL_CONFIG.colors;

    for (let i = 0; i < this.metaballCount; i++) {
      // Blobs can range in size
      const size = random(30, 80); 
      
      this.metaballs.push({
        pos: createVector(random(this.width), random(this.height)),
        vel: p5.Vector.random2D().mult(random(0.5, 1.5)), // Slow drift
        radius: size
      });
      
      const colorIndex = i % configColors.length;
      const c = configColors[colorIndex];
      this.metaballColors.push([c[0], c[1], c[2]]);
    }
  }
  
  update() {
    // Move blobs and bounce off screen edges
    for (let mb of this.metaballs) {
        mb.pos.add(mb.vel);
        
        // Bounce
        if (mb.pos.x < mb.radius || mb.pos.x > this.width - mb.radius) {
            mb.vel.x *= -1;
            mb.pos.x = constrain(mb.pos.x, mb.radius, this.width - mb.radius);
        }
        if (mb.pos.y < mb.radius || mb.pos.y > this.height - mb.radius) {
            mb.vel.y *= -1;
            mb.pos.y = constrain(mb.pos.y, mb.radius, this.height - mb.radius);
        }
    }
  }

  draw() {
    const g = this.g;
    g.clear();
    g.blendMode(BLEND);
    
    const time = millis() * 0.001;
    const w = this.width;
    const h = this.height;

    // Prepare data for shader
    const data = [];
    for (let mb of this.metaballs) {
        data.push(mb.pos.x, mb.pos.y, mb.radius);
    }
    
    const flatColors = [];
    for (let c of this.metaballColors) {
        flatColors.push(c[0]/255, c[1]/255, c[2]/255);
    }

    // Render layers for neon glow
    for (let layer = 0; layer < this.neonLayers; layer++) {
        const colorVar = sin(time * 0.5 + layer * 0.7) * 25 + cos(time * 0.3 + layer) * 15;
        const currentAlpha = this.blobAlpha;
        
        const layerColor = [
            constrain(this.fillColor[0] + colorVar, 0, 255) / 255,
            constrain(this.fillColor[1] + colorVar * 0.8, 0, 255) / 255,
            constrain(this.fillColor[2] + colorVar * 1.2, 0, 255) / 255,
            currentAlpha
        ];

        g.shader(this.metaballShader);
        
        this.metaballShader.setUniform("uResolution", [w, h]);
        this.metaballShader.setUniform("metaballs", data);
        this.metaballShader.setUniform("metaballColors", flatColors);
        this.metaballShader.setUniform("uColor", layerColor);
        this.metaballShader.setUniform("uThreshold", 1.0);
        // Center/Radius are irrelevant for full screen drift if we disable clipping in shader
        // We pass -1 for radius to indicate "no clipping" (modified logic in shader below/above)
        // Wait, I need to update the shader to support this "no clipping" mode.
        // In the updated getMetaballFrag, I added: if (uFuzziness <= 0.0 && uRadius >= 0.0) ...
        // So passing -1.0 for uRadius will disable the circle clip.
        this.metaballShader.setUniform("uCenter", [w/2, h/2]);
        this.metaballShader.setUniform("uRadius", -1.0); 
        this.metaballShader.setUniform("uFuzziness", 0.0);
        
        g.rectMode(CENTER);
        g.noStroke();
        g.rect(0, 0, w, h);
    }
    
    // Draw buffer to main canvas
    imageMode(CORNER); // Full screen
    image(g, 0, 0, width, height);
  }
}
