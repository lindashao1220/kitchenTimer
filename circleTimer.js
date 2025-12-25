// --- GLOBAL CONFIGURATION ---
// This object holds settings that are easy to change in one place.
const METABALL_CONFIG = {
  // A list of colors for the blobs. Format is [Red, Green, Blue].
  colors: [
      [0, 255, 255],   // Cyan
      [255, 0, 255],   // Magenta
      [50, 100, 255],  // Electric Blue
      [200, 50, 200]   // Violet
  ],
  // How see-through the blobs are (0.0 is invisible, 1.0 is solid)
  transparency: 0.9
};

// --- CIRCLE TIMER CLASS ---
// A Class is like a blueprint for creating objects.
// This one handles the timer logic, the bouncing blobs, and the visual effects.
class CircleTimer {

  // The 'constructor' runs when we create a new timer (new CircleTimer(...))
  constructor(duration, beyondDurationMinutes, x, y, radius, color) {
    // Save the settings we were given
    this.duration = duration * 1000; // Convert seconds to milliseconds
    this.beyondDuration = (beyondDurationMinutes || 1) * 60 * 1000; // Convert minutes to ms
    this.x = x; // Center X position on screen
    this.y = y; // Center Y position on screen
    this.radius = radius; // How big the circle starts
    
    // State variables (tracking what is happening)
    this.startTime = null; // When did the timer start?
    this.isRunning = false; // Is it ticking right now?
    this.isComplete = false; // Did the main timer finish?
    this.completionTime = null; // When did it finish?

    // Color setup
    this.bgColor = [200, 200, 200];
    // If a custom color was passed, use it, otherwise use a default greenish color
    if (color && color.length >= 3) {
      this.fillColor = [color[0], color[1], color[2]];
    } else {
      this.fillColor = [90, 100, 22, 128];
    }
    this.strokeColor = [55]; // Dark grey outline

    // --- METABALL VISUALS SETUP ---
    // We use a special graphics buffer (WEBGL) for fast, advanced rendering.
    this.metaballCount = 12; // How many blobs are there?
    
    // createGraphics makes an off-screen canvas to draw on.
    // We make it the full size of the window so blobs can go anywhere.
    this.g = createGraphics(width, height, WEBGL);
    this.g.noStroke();
    this.g.pixelDensity(1); // Standard pixel density for performance

    // Load the special shader programs (vertex and fragment)
    this.metaballShader = this.g.createShader(this.metaballVert(), this.metaballFrag());
    this.g.shader(this.metaballShader);

    // Create the physics particles (the moving blobs)
    this.metaballs = [];
    this.metaballColors = []; // Store the color for each blob
    
    // Get colors from our global config
    const configColors = METABALL_CONFIG.colors;

    // Loop to create each blob
    for (let i = 0; i < this.metaballCount; i++) {
      const baseSize = random(0.3, 0.6); // Random size for each blob

      this.metaballs.push({
        // Start at the center of the timer
        pos: createVector(this.x, this.y),
        // Give it a random speed and direction
        vel: p5.Vector.random2D().mult(random(1, 3)),
        // Calculate its individual radius
        baseRadius: this.radius * baseSize
      });
      
      // Pick a color from the list, cycling through if we run out
      const colorIndex = i % configColors.length;
      const c = configColors[colorIndex];
      this.metaballColors.push([c[0], c[1], c[2]]);
    }

    // Settings for the "glowing" effect
    this.neonLayers = 5; // How many times we draw it to make it glow
    this.blobAlpha = METABALL_CONFIG.transparency; // Transparency from config
  }

  // Starts the timer
  start() {
    this.startTime = millis(); // Record the current time
    this.isRunning = true;
    this.isComplete = false;
  }

  // Resets the timer to the beginning
  reset() {
    this.startTime = null;
    this.isRunning = false;
    this.isComplete = false;
  }

  // Updates the timer state (runs every frame)
  update() {
    if (!this.isRunning || !this.startTime) return;

    // Check if time is up
    const elapsed = millis() - this.startTime;
    if (elapsed >= this.duration) {
      this.isComplete = true; // Timer is done!
      this.isRunning = false;

      // Mark the exact moment it finished
      if (this.completionTime === null) {
        this.completionTime = millis();
      }
    }
  }

  // Calculates how far along the timer is (0.0 to 1.0)
  getProgress() {
    if (!this.startTime) return 0;
    const elapsed = millis() - this.startTime;
    // ensure the result stays between 0 and 1
    return constrain(elapsed / this.duration, 0, 1);
  }

  // Draws everything to the main screen
  draw() {
    // 1. Draw the outer circle ring (if timer isn't done yet)
    if (!this.isComplete) {
      noFill();
      stroke(this.strokeColor);
      strokeWeight(2);
      circle(this.x, this.y, this.radius * 2);
    }

    // 2. Calculate values for the visuals
    let progress = this.getProgress();
    let globalAlpha = 1.0;
    let fuzziness = 0.0;
    let renderRadius = this.radius;
    
    // 3. "Beyond" Phase Logic (After timer finishes)
    // The blobs grow and get fuzzy instead of shrinking.
    if (this.isComplete) {
      const beyondElapsed = this.completionTime ? millis() - this.completionTime : 0;

      // 't' goes from 0 to 1 over the 'Beyond' duration
      const growDuration = this.beyondDuration;
      const t = constrain(beyondElapsed / growDuration, 0, 1);
      
      // Keep progress at full (big blobs)
      progress = 1.0;
      
      // Fuzziness increases over time
      fuzziness = t;
      
      // The drawing area grows from the original circle to fill the screen
      let maxR = max(width, height);
      renderRadius = lerp(this.radius, maxR, t);
    }

    // 4. Calculate visual scale for expansion
    if (this.isComplete) {
        // Find how much bigger the screen is compared to the timer
        let maxR = max(width, height); 
        let growthRatio = maxR / (this.radius > 1 ? this.radius : 1);

        // Smoothly scale the blobs up
        progress = lerp(1.0, growthRatio, fuzziness);
    }

    // 5. Draw the blobs into the off-screen buffer
    this.renderMetaballs(progress, globalAlpha, fuzziness, renderRadius);
    
    // 6. Draw the off-screen buffer onto the main canvas
    imageMode(CENTER);
    image(this.g, width / 2, height / 2);
  }

  // Helper function to handle the heavy lifting of drawing blobs
  renderMetaballs(progress, globalAlpha = 1.0, fuzziness = 0.0, renderRadius = null) {
    const g = this.g;

    // 'p' controls the size of the blobs
    let p = progress;
    if (fuzziness === 0) {
        p = constrain(progress, 0, 1);
    }
    
    // If progress is 0, don't draw anything
    if (p <= 0 && fuzziness === 0) {
      g.clear();
      return;
    }

    const currentRadius = renderRadius !== null ? renderRadius : this.radius;

    // --- PHYSICS UPDATE ---
    // Move the blobs around
    const data = []; // This will hold data to send to the GPU (shader)
    const w = g.width;
    const h = g.height;
    
    // Define the walls the blobs bounce off
    let minX = 0;
    let maxX = w;
    let minY = 0;
    let maxY = h;

    // If we are NOT in the "Beyond" phase, keep them inside the timer circle
    if (!this.isComplete && fuzziness === 0) {
        const r = this.radius;
        minX = this.x - r;
        maxX = this.x + r;
        minY = this.y - r;
        maxY = this.y + r;
    }

    // Loop through each blob
    for (let mb of this.metaballs) {
      
      // Move blob by its velocity
      mb.pos.add(mb.vel);
      
      // Check for collisions with walls and bounce
      if (mb.pos.x < minX + mb.baseRadius || mb.pos.x > maxX - mb.baseRadius) {
          mb.vel.x *= -1; // Reverse horizontal direction
          // Keep it inside the bounds
          mb.pos.x = constrain(mb.pos.x, minX + mb.baseRadius, maxX - mb.baseRadius);
      }
      if (mb.pos.y < minY + mb.baseRadius || mb.pos.y > maxY - mb.baseRadius) {
          mb.vel.y *= -1; // Reverse vertical direction
          mb.pos.y = constrain(mb.pos.y, minY + mb.baseRadius, maxY - mb.baseRadius);
      }

      // Add position and size to the data array
      const r = mb.baseRadius * p;
      data.push(mb.pos.x, mb.pos.y, r);
    }

    // --- RENDERING ---
    // Prepare the graphics buffer
    g.clear();
    g.blendMode(BLEND); 
    
    const time = millis() * 0.001; // Current time in seconds

    // Draw multiple layers to create the neon glow
    for (let layer = 0; layer < this.neonLayers; layer++) {
      // Calculate a shifting color for this layer (animation)
      const colorVar = sin(time * 0.5 + layer * 0.7) * 25 + cos(time * 0.3 + layer) * 15;
      const currentAlpha = this.blobAlpha * globalAlpha;
      
      const layerColor = [
        constrain(this.fillColor[0] + colorVar, 0, 255) / 255,
        constrain(this.fillColor[1] + colorVar * 0.8, 0, 255) / 255,
        constrain(this.fillColor[2] + colorVar * 1.2, 0, 255) / 255,
        currentAlpha
      ];

      // Activate the shader
      g.shader(this.metaballShader);

      // Convert colors to format shader likes (0.0 - 1.0)
      const flatColors = [];
      for(let c of this.metaballColors) {
        flatColors.push(c[0]/255, c[1]/255, c[2]/255);
      }

      // Send all our data to the GPU
      this.metaballShader.setUniform("uResolution", [w, h]);
      this.metaballShader.setUniform("metaballs", data); // Blob positions
      this.metaballShader.setUniform("metaballColors", flatColors); // Blob colors
      this.metaballShader.setUniform("uColor", layerColor); // Tint color
      this.metaballShader.setUniform("uThreshold", 1.0); // Blob stickiness
      this.metaballShader.setUniform("uCenter", [this.x, this.y]);
      this.metaballShader.setUniform("uRadius", currentRadius);
      this.metaballShader.setUniform("uFuzziness", fuzziness);
      
      // Draw a rectangle covering the screen (the shader draws on this)
      g.rectMode(CENTER);
      g.noStroke();
      g.rect(0, 0, w, h);
    }
  }

  // --- SHADER CODE (VERTEX) ---
  // This is a small program that runs on the graphics card.
  // It handles the position of the drawing surface.
  metaballVert() {
    return `
      attribute vec3 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      void main() {
        vTexCoord = aTexCoord;
        vec4 positionVec4 = vec4(aPosition, 1.0);
        // Map position from 0..1 to -1..1
        positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
        gl_Position = positionVec4;
      }
    `;
  }

  // --- SHADER CODE (FRAGMENT) ---
  // This is the program that calculates the color of every single pixel.
  // It creates the "metaball" gooey effect.
  metaballFrag() {
    return `
      precision highp float;
      varying vec2 vTexCoord;

      // Variables sent from JavaScript
      uniform vec3 metaballs[${this.metaballCount}];
      uniform vec3 metaballColors[${this.metaballCount}];
      uniform vec2 uResolution;
      uniform vec4 uColor;
      uniform float uThreshold;
      uniform vec2 uCenter;
      uniform float uRadius;
      uniform float uFuzziness;

      // Random number generator function
      float random (vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
      }

      void main() {
        // Calculate pixel coordinates
        float x = vTexCoord.x * uResolution.x;
        float y = vTexCoord.y * uResolution.y;

        // --- CLIPPING ---
        // If the pixel is outside the timer circle, don't draw it (unless fuzzy)
        if (uFuzziness <= 0.0) {
          if (distance(vec2(x, y), uCenter) > uRadius) {
            discard; // Throw away this pixel
          }
        }

        // --- BLOB CALCULATION ---
        float v = 0.0; // The "strength" of the blob field at this pixel
        vec3 accumColor = vec3(0.0);
        float totalWeight = 0.0;
        
        // Add some grain/noise for texture
        vec2 noisePos = vec2(x, y) * 0.05; 
        float n = random(noisePos);

        // Loop through all blobs to see how close they are to this pixel
        for (int i = 0; i < ${this.metaballCount}; i++) {
          vec3 ball = metaballs[i];
          float dx = ball.x - x;
          float dy = ball.y - y;
          float r = ball.z; // Radius

          // Formula for metaball influence (inverse square law)
          float influence = r * r / (dx * dx + dy * dy + 1e-5);
          v += influence; // Add to total strength
          
          // Blend colors based on influence
          accumColor += metaballColors[i] * influence;
          totalWeight += influence;
        }
        
        // Calculate average color
        vec3 blendedColor = accumColor / (totalWeight + 1e-5);
        
        // Adjust threshold with noise for texture
        float threshold = uThreshold * 0.8 + (n - 0.5) * 0.1;

        // --- FINAL COLOR OUTPUT ---
        if (uFuzziness > 0.0) {
            // "Beyond" Mode: Fuzzy edges
            // Smoothly fade transparency based on strength 'v'
            
            float lowerBound = threshold * (1.0 - uFuzziness * 0.95);
            float upperBound = threshold + (uFuzziness * 0.2); 
            
            float alpha = smoothstep(lowerBound, upperBound, v);
            
            // Add texture to color
            vec3 finalColor = blendedColor * (0.95 + 0.1 * n);
            
            // Set the pixel color
            gl_FragColor = vec4(finalColor, alpha * uColor.a);
            
        } else {
            // Standard Mode: Sharp edges
            if (v >= threshold) {
              // Calculate edge glow
              float distFromCenter = distance(vec2(x, y), uCenter) / uRadius;
              float edgeGlow = 1.0 - smoothstep(0.7, 1.0, distFromCenter);
              
              // Soften the edge slightly for anti-aliasing
              float alphaStrength = smoothstep(threshold, threshold + 0.5, v);
              float finalAlpha = uColor.a * alphaStrength * (0.6 + 0.4 * edgeGlow);

              vec3 finalColor = blendedColor * (0.95 + 0.1 * n);
              gl_FragColor = vec4(finalColor, finalAlpha);
            } else {
              // If not strong enough, draw nothing (transparent)
              gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
            }
        }
      }
    `;
  }
}
