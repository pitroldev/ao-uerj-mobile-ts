import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash
import UIKit

/// A janela do app no ciclo de vida com cenas (UIScene), o do template do
/// React Native 0.88 e o que o SDK do iOS 27 exige. Também recebe as
/// aberturas que, com cenas, não passam mais pelo `AppDelegate`: o atalho
/// do ícone e o toque no widget, na abertura e com o app aberto.
class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    // o app abriu por um atalho do ícone ou pelo widget
    if let shortcutItem = connectionOptions.shortcutItem {
      LaunchCenter.shared.open(shortcutItem.type)
    }
    openTarget(from: connectionOptions.urlContexts)

    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: windowScene)

    reactNativeFactory?.startReactNative(
      withModuleName: "aouerjmobile",
      in: window,
      connectionOptions: connectionOptions
    )
  }

  // Atalho do ícone (Info.plist, UIApplicationShortcutItems) com o app aberto: o tipo é o destino.
  func windowScene(
    _ windowScene: UIWindowScene,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    LaunchCenter.shared.open(shortcutItem.type)
    completionHandler(true)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    if !openTarget(from: URLContexts) {
      RCTLinkingManager.scene(scene, openURLContexts: URLContexts)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
  }

  /// Toque no widget: aouerj://open?target=home. O JS confere o destino.
  @discardableResult
  private func openTarget(from contexts: Set<UIOpenURLContext>) -> Bool {
    for context in contexts {
      let url = context.url
      guard url.scheme == "aouerj", url.host == "open",
        let target = URLComponents(url: url, resolvingAgainstBaseURL: false)?
          .queryItems?.first(where: { $0.name == "target" })?.value
      else { continue }
      LaunchCenter.shared.open(target)
      return true
    }
    return false
  }

  // Mantém o BootSplash.storyboard sobre a view raiz até o JS chamar BootSplash.hide().
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
