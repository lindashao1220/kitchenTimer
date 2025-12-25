from playwright.sync_api import sync_playwright
import time

def verify_timer_expansion():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 800, 'height': 600})
        page = context.new_page()

        # Navigate to the local server
        page.goto("http://localhost:8000")

        # Wait for page to load
        page.wait_for_timeout(2000)

        # Press 's' to enter setup
        page.keyboard.press("s")
        page.wait_for_timeout(1000)

        # Set duration to 1 second (press '2' multiple times to decrease)
        # Default is 5. Key '2' decreases.
        for _ in range(4):
            page.keyboard.press("2")
            time.sleep(0.1)

        # Start timer (SPACE)
        page.keyboard.press(" ")

        # Wait for timer to complete (1s) and start expanding
        # We want to capture the expansion phase
        time.sleep(1.5)

        # Take screenshot during expansion
        page.screenshot(path="verification/expansion_mid.png")

        # Wait more to see full expansion
        time.sleep(2.0)
        page.screenshot(path="verification/expansion_late.png")

        browser.close()

if __name__ == "__main__":
    verify_timer_expansion()
