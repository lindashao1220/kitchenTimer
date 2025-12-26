from playwright.sync_api import sync_playwright, expect
import time

def verify_explosion():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8000/index.html")

        # Wait for p5 to initialize
        time.sleep(3)

        # Enter SETUP mode
        page.keyboard.press("s")
        time.sleep(1)

        # Set durationInput to 1 via JS
        page.evaluate("window.durationInput = 2;")
        page.evaluate("window.beyondInput = 1;")

        # Start timer
        page.keyboard.press(" ")

        # Wait for timer to finish (2 seconds) + buffer
        time.sleep(4)

        # Take screenshot of Beyond phase
        page.screenshot(path="verification/beyond_phase.png")

        browser.close()

if __name__ == "__main__":
    verify_explosion()
