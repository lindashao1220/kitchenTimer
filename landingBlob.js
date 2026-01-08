// LandingBlob Class
// Used for the decorative blobs in the instructions/landing mode.
class LandingBlob {
  constructor(x, y, r, color) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.color = color;
    this.xOff = random(1000);
    this.yOff = random(1000);
    this.speed = random(0.002, 0.005);
  }

  update() {
    this.xOff += this.speed;
    this.yOff += this.speed;
    // Slight wandering movement
    this.x += (noise(this.xOff) - 0.5) * 2;
    this.y += (noise(this.yOff) - 0.5) * 2;
  }

  draw() {
    noStroke();
    fill(this.color[0], this.color[1], this.color[2], 50); // Semi-transparent
    circle(this.x, this.y, this.r * 2);
  }
}
