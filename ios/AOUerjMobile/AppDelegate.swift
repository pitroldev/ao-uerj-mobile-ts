import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Remove cached legacy AO login URLs before a React networking session starts.
    // Credentials and account preferences live in separate, untouched stores.
    URLCache.shared.removeAllCachedResponses()

    // antes de terminar a abertura, para receber o toque no aviso que abriu o app
    UNUserNotificationCenter.current().delegate = LaunchCenter.shared

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "aouerjmobile",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }

  // Atalho do ícone (Info.plist, UIApplicationShortcutItems): o tipo é o destino.
  // Também chega na abertura, porque a função acima devolve true.
  func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    LaunchCenter.shared.open(shortcutItem.type)
    completionHandler(true)
  }

  // Toque no widget: aouerj://open?target=home. O JS confere o destino.
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    guard url.scheme == "aouerj", url.host == "open",
      let target = URLComponents(url: url, resolvingAgainstBaseURL: false)?
        .queryItems?.first(where: { $0.name == "target" })?.value
    else { return false }
    LaunchCenter.shared.open(target)
    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  // Keeps BootSplash.storyboard over the root view until JS calls BootSplash.hide().
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
