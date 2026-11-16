import XCTest

final class StoreScreenshots: XCTestCase {
  @MainActor
  func testPublicMap() throws {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "com.aouerjmobile")
    app.launch()
    let explore = app.buttons["Explorar o mapa"]
    XCTAssertTrue(explore.waitForExistence(timeout: 45), app.debugDescription)
    capture("01-login", app)
    explore.tap()

    let search = app.textFields["Buscar sala ou lugar"]
    XCTAssertTrue(search.waitForExistence(timeout: 20), app.debugDescription)
    XCTAssertTrue(app.buttons["Ampliar mapa"].waitForExistence(timeout: 20))
    capture("02-mapa", app)

    let libraries = app.buttons["Bibliotecas"]
    if libraries.exists {
      libraries.tap()
      capture("03-bibliotecas", app)
    }
  }

  @MainActor
  private func capture(_ name: String, _ app: XCUIApplication) {
    let image = XCTAttachment(screenshot: app.screenshot())
    image.name = name
    image.lifetime = .keepAlways
    add(image)
  }
}
