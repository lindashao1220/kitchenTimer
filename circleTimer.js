// Global configuration for metaballs
// This object makes it easy to change colors and transparency without hunting through the code.
const METABALL_CONFIG = {
  // Array of RGB values for individual metaballs
  // These are the "electric" colors: Cyan, Magenta, Electric Blue, Violet
  colors: [
      [0, 255, 255],   // Cyan
      [255, 0, 255],   // Magenta
      [50, 100, 255],  // Electric Blue
      [200, 50, 200]   // Violet
  ],
  // Base transparency (0.0 to 1.0)
  // Higher values make the blobs more opaque.
  transparency: 0.9,
  // Number of metaballs to render
  metaballCount: 12
};

/**
 * CircleTimer Class
 * 
 * This class acts as a "blueprint" for our timer. It handles:
 * 1. Tracking time (start, update, complete).
 * 2. Simulating physics (the drifting "metaball" blobs).
 * 3. Rendering the visuals using advanced graphics (shaders).
 */
class CircleTimer {
  constructor(duration, beyondDurationMinutes, x, y, radius, color) {
    // Time settings
    this.duration = duration * 1000; // Convert seconds to milliseconds
    this.beyondDuration = (beyondDurationMinutes || 1) * 60 * 1000; // Convert minutes to milliseconds
    
    // Position and Size
    this.x = x;
    this.y = y;
    this.radius = radius;
    
    // State tracking variables
    this.startTime = null;      // When the timer started
    this.isRunning = false;     // Is it currently counting down?
    this.isComplete = false;    // Has it finished the main countdown?
    this.completionTime = null; // When did it finish? (Used for the "Beyond" phase animation)
    
    // Color & style
    this.bgColor = [200, 200, 200];
    // Set fill color with 50% transparency (alpha = 128)
    if (color && color.length >= 3) {
      this.fillColor = [color[0], color[1], color[2]];
    } else {
      this.fillColor = [90, 100, 22, 128]; // Default greenish color
    }
    this.strokeColor = [55]; // Dark grey for the circle outline
    
    // --- Metaball Setup ---
    // Metaballs are the organic, blobby shapes inside the timer.
    // We use a specialized "Shader" to draw them because it's much faster 
    // and allows for cool effects like blending and neon glows.
    
    this.metaballCount = METABALL_CONFIG.metaballCount; // How many blobs?
    
    // We create a separate graphics buffer (like a virtual canvas) to draw the shader.
    // We use the full window size so the blobs can eventually drift anywhere on screen.
    this.g = createGraphics(width, height, WEBGL);
    this.g.noStroke();
    this.g.pixelDensity(1);
    
    // Load the shader programs (defined at the bottom of this file)
    this.metaballShader = this.g.createShader(getMetaballVert(), getMetaballFrag(this.metaballCount));
    this.g.shader(this.metaballShader);
    
    this.metaballs = [];
    this.metaballColors = []; // Store specific colors for each blob
    
    // Initialize our blobs
    const configColors = METABALL_CONFIG.colors;

    for (let i = 0; i < this.metaballCount; i++) {
      const baseSize = random(0.3, 0.6); // Randomize size relative to the timer
      
      // Each blob is an object with position, velocity (movement), and size
      this.metaballs.push({
        pos: createVector(this.x, this.y), // Start at the center
        vel: p5.Vector.random2D().mult(random(1, 3)), // Move in a random direction
        baseRadius: this.radius * baseSize
      });
      
      // Assign a color from our config, cycling through the list
      const colorIndex = i % configColors.length;
      const c = configColors[colorIndex];
      this.metaballColors.push([c[0], c[1], c[2]]);
    }
    
    // Visual tweak settings
    this.neonLayers = 5; // How many times we draw to create the "glow" look
    this.blobAlpha = METABALL_CONFIG.transparency;
  }

  // Starts the timer
  start() {
    this.startTime = millis();
    this.isRunning = true;
    this.isComplete = false;
  }

  // Resets the timer to initial state
  reset() {
    this.startTime = null;
    this.isRunning = false;
    this.isComplete = false;
  }

  // Called every frame to check if time is up
  update() {
    if (!this.isRunning || !this.startTime) return;
    
    const elapsed = millis() - this.startTime;
    
    // If we passed the duration, mark as complete
    if (elapsed >= this.duration) {
      this.isComplete = true;
      this.isRunning = false;
      
      // Record the exact time we finished, so we can animate the "Beyond" phase relative to this moment
      if (this.completionTime === null) {
        this.completionTime = millis();
      }
    }
  }

  // Returns a number from 0.0 to 1.0 representing how much time has passed
  getProgress() {
    if (!this.startTime) return 0;
    const elapsed = millis() - this.startTime;
    return constrain(elapsed / this.duration, 0, 1);
  }

  // The main drawing function
  draw() {
    let progress = this.getProgress();
    let globalAlpha = 1.0;
    let fuzziness = 0.0;
    let renderRadius = this.radius;
    let currentStrokeColor = this.strokeColor;
    
    // --- Beyond Phase Logic ---
    // If the timer is complete, we enter the "Beyond" phase where:
    // 1. The blobs stop shrinking and stay big.
    // 2. The boundary circle expands to fill the screen.
    // 3. The outline fades to white.
    
    if (this.isComplete) {
      const beyondElapsed = this.completionTime ? millis() - this.completionTime : 0;
      
      // Grow blobs over the beyond duration to eventually fill the screen
      // 1.0 is normal size, 20.0 should be enough to fill the view
      // The speed depends on the total beyond duration.
      const growthProgress = constrain(beyondElapsed / this.beyondDuration, 0, 1);
      progress = 1.0 + (growthProgress * 20.0);
      
      fuzziness = 0.0;
      
      // Calculate expansion animation (0.0 to 1.0 over 5 seconds)
      let t_exp = constrain(beyondElapsed / 5000, 0, 1);
      // "Smoothstep" formula makes the animation start and end gently
      t_exp = t_exp * t_exp * (3 - 2 * t_exp); 
      
      // Expand the radius from original size to larger than screen
      renderRadius = lerp(this.radius, max(width, height) * 1.5, t_exp);
      
      // Change the stroke color to white
      currentStrokeColor = 255;
    }

    // Draw the outer ring
    noFill();
    stroke(currentStrokeColor);
    strokeWeight(2);
    circle(this.x, this.y, renderRadius * 2);

    // Draw the blobs
    this.renderMetaballs(progress, globalAlpha, fuzziness, renderRadius);
    
    // Display the shader buffer on the main canvas
    imageMode(CENTER);
    image(this.g, width / 2, height / 2);
  }

  /**
   * renderMetaballs
   * This function handles the physics update and shader rendering for the blobs.
   */
  renderMetaballs(progress, globalAlpha = 1.0, fuzziness = 0.0, renderRadius = null) {
    const g = this.g;
    let p = progress;
    
    // If progress is zero, don't draw anything
    if (p <= 0 && fuzziness === 0) {
      g.clear();
      return;
    }

    const currentRadius = renderRadius !== null ? renderRadius : this.radius;

    // --- Physics & Boundaries ---
    const data = [];
    const w = g.width;
    const h = g.height;
    
    // Determine the "walls" that blobs bounce off of.
    // Initially, they are trapped inside the timer circle.
    // In the "Beyond" phase, these walls expand to the full screen.
    
    let targetMinX = 0;
    let targetMaxX = w;
    let targetMinY = 0;
    let targetMaxY = h;

    // The initial tight bounds around the timer
    const r = this.radius;
    let startMinX = this.x - r;
    let startMaxX = this.x + r;
    let startMinY = this.y - r;
    let startMaxY = this.y + r;

    let minX, maxX, minY, maxY;

    if (!this.isComplete && fuzziness === 0) {
        // Normal mode: strict bounds
        minX = startMinX;
        maxX = startMaxX;
        minY = startMinY;
        maxY = startMaxY;
    } else {
        // Beyond phase: Interpolate bounds from circle to full screen over 5 seconds
        let elapsed = 0;
        if (this.completionTime) elapsed = millis() - this.completionTime;
        
        // Calculate animation progress (0 to 1)
        let t = constrain(elapsed / 5000, 0, 1); 
        t = t * t * (3 - 2 * t); // Apply smoothing

        // Interpolate (blend) between start bounds and full screen bounds
        minX = lerp(startMinX, targetMinX, t);
        maxX = lerp(startMaxX, targetMaxX, t);
        minY = lerp(startMinY, targetMinY, t);
        maxY = lerp(startMaxY, targetMaxY, t);
    }

    // Loop through each blob to update its position
    for (let i = 0; i < this.metaballs.length; i++) {
      let mb = this.metaballs[i];
      
      // Move the blob
      mb.pos.add(mb.vel);
      
      // Debug: Log position (Requested feature)
      // Note: This prints a LOT to the console!
      console.log(`Metaball ${i} position:`, mb.pos.x, mb.pos.y);

      // --- Beyond Phase Drift ---
      // When the timer ends, we gently push the blobs out of the center
      // so they drift apart nicely as the walls expand.
      if (this.isComplete && this.completionTime) {
        const beyondElapsed = millis() - this.completionTime;
        // "Ramp up" the force over 3 seconds so it's not jumpy
        const rampUp = constrain(beyondElapsed / 3000, 0, 1);
        
        if (rampUp > 0) {
            const distFromCenter = dist(mb.pos.x, mb.pos.y, this.x, this.y);
            // If the blob is still near the center, push it away
            if (distFromCenter < this.radius) {
                let pushDir = p5.Vector.sub(mb.pos, createVector(this.x, this.y));
                pushDir.normalize();
                pushDir.mult(0.05 * rampUp); // Apply the gentle force
                mb.vel.add(pushDir);
            }
        }
      }
      
      // Bounce off the calculated walls
      if (mb.pos.x < minX + mb.baseRadius || mb.pos.x > maxX - mb.baseRadius) {
          mb.vel.x *= -1;
          // Keep it inside
          mb.pos.x = constrain(mb.pos.x, minX + mb.baseRadius, maxX - mb.baseRadius);
      }
      if (mb.pos.y < minY + mb.baseRadius || mb.pos.y > maxY - mb.baseRadius) {
          mb.vel.y *= -1;
          mb.pos.y = constrain(mb.pos.y, minY + mb.baseRadius, maxY - mb.baseRadius);
      }

      // Prepare data for the shader
      const blobRadius = mb.baseRadius * p;
      data.push(mb.pos.x, mb.pos.y, blobRadius);
    }

    // --- Rendering ---
    // We draw multiple layers to create a "neon glow" effect.
    g.clear();
    g.blendMode(BLEND); 
    
    const time = millis() * 0.001; 
    
    for (let layer = 0; layer < this.neonLayers; layer++) {
      // Vary color slightly per layer for a shimmering effect
      const colorVar = sin(time * 0.5 + layer * 0.7) * 25 + cos(time * 0.3 + layer) * 15;
      const currentAlpha = this.blobAlpha * globalAlpha;
      
      const layerColor = [
        constrain(this.fillColor[0] + colorVar, 0, 255) / 255,
        constrain(this.fillColor[1] + colorVar * 0.8, 0, 255) / 255,
        constrain(this.fillColor[2] + colorVar * 1.2, 0, 255) / 255,
        currentAlpha
      ];

      // Pass all data to the GPU shader
      g.shader(this.metaballShader);
      
      // Flatten the color array for the shader
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
      this.metaballShader.setUniform("uFuzziness", fuzziness);
      
      // Draw a rectangle covering the screen to run the shader on every pixel
      g.rectMode(CENTER);
      g.noStroke();
      g.rect(0, 0, w, h);
    }
  }

}

// --- Shader Code ---
// Shaders run on the graphics card and are very fast.
// This vertex shader just sets up the geometry (a simple flat rectangle).
function getMetaballVert() {
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

// This fragment shader calculates the color of every pixel.
function getMetaballFrag(metaballCount) {
  return `
    precision highp float;
    varying vec2 vTexCoord;
    uniform vec3 metaballs[${metaballCount}];
    uniform vec3 metaballColors[${metaballCount}];
    uniform vec2 uResolution;
    uniform vec4 uColor;
    uniform float uThreshold;
    uniform vec2 uCenter;
    uniform float uRadius;
    uniform float uFuzziness;

    // Simple pseudo-random function for noise
    float random (vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
    }

    void main() {
      // Convert texture coordinates (0-1) to pixel coordinates
      float x = vTexCoord.x * uResolution.x;
      float y = vTexCoord.y * uResolution.y;

      // --- Clipping Logic ---
      // If we are NOT in the fuzzy/expansion mode, we only draw inside the circle.
      // uRadius < 0 means disable clipping (used for LandingVisuals)
      if (uFuzziness <= 0.0 && uRadius >= 0.0) {
        if (distance(vec2(x, y), uCenter) > uRadius) {
          discard; // Don't draw this pixel
        }
      }

      // --- Metaball Calculation ---
      // We sum up the "influence" of every blob at this pixel.
      // Influence drops off with distance squared.
      float v = 0.0;
      vec3 accumColor = vec3(0.0);
      float totalWeight = 0.0;
      
      vec2 noisePos = vec2(x, y) * 0.05; 
      float n = random(noisePos); // Add some grain/texture

      for (int i = 0; i < ${metaballCount}; i++) {
        vec3 ball = metaballs[i];
        float dx = ball.x - x;
        float dy = ball.y - y;
        float r = ball.z; // Radius
        
        // The magic formula for metaballs
        float influence = r * r / (dx * dx + dy * dy + 1e-5);
        v += influence;
        
        // Blend colors based on influence
        accumColor += metaballColors[i] * influence;
        totalWeight += influence;
      }
      
      vec3 blendedColor = accumColor / (totalWeight + 1e-5);
      
      // Threshold defines the "edge" of the blob
      float threshold = uThreshold * 0.8 + (n - 0.5) * 0.1;

      if (uFuzziness > 0.0) {
          // Fuzzy mode logic (not currently used heavily, but allows for soft edges)
          float lowerBound = threshold * (1.0 - uFuzziness * 0.95);
          float upperBound = threshold + (uFuzziness * 0.2); 
          float alpha = smoothstep(lowerBound, upperBound, v);
          vec3 finalColor = blendedColor * (0.95 + 0.1 * n);
          gl_FragColor = vec4(finalColor, alpha * uColor.a);
          
      } else {
          // Normal mode logic
          if (v >= threshold) {
            // Calculate edge glow
            float distFromCenter = 0.0;
            float edgeGlow = 0.0;
            
            if (uRadius >= 0.0) {
                distFromCenter = distance(vec2(x, y), uCenter) / uRadius;
                edgeGlow = 1.0 - smoothstep(0.7, 1.0, distFromCenter);
            }
            
            // Smooth edges for anti-aliasing
            float alphaStrength = smoothstep(threshold, threshold + 0.5, v);
            float finalAlpha = uColor.a * alphaStrength * (0.6 + 0.4 * edgeGlow);
            
            vec3 finalColor = blendedColor * (0.95 + 0.1 * n);
            gl_FragColor = vec4(finalColor, finalAlpha);
          } else {
            // Background (transparent)
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
          }
      }
    }
  `;
}
