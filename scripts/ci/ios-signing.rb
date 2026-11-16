# Altera só a cópia descartável do projeto no runner, depois do pod install.
require 'xcodeproj'

project = Xcodeproj::Project.open('ios/AOUerjMobile.xcodeproj')
profiles = {
  'aouerjmobile' => ENV.fetch('IOS_APP_PROFILE_UUID'),
  'NextClassWidget' => ENV.fetch('IOS_WIDGET_PROFILE_UUID')
}
profiles.each do |name, profile|
  target = project.targets.find { |candidate| candidate.name == name }
  raise "Alvo não encontrado: #{name}" unless target

  target.build_configurations.each do |configuration|
    next unless configuration.name == 'Release'

    configuration.build_settings['CODE_SIGN_STYLE'] = 'Manual'
    configuration.build_settings['DEVELOPMENT_TEAM'] = ENV.fetch('APPLE_TEAM_ID')
    configuration.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
    configuration.build_settings['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = 'Apple Distribution'
    configuration.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = profile
  end
end
project.save
