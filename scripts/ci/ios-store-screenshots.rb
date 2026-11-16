# A standalone XCTest runner exercises the already installed Release app.
# It does not add test hooks or targets to the application shipped to the store.
require 'fileutils'
require 'xcodeproj'

directory = File.expand_path(ARGV.fetch(0))
FileUtils.mkdir_p(directory)
FileUtils.cp(File.join(__dir__, 'StoreScreenshots.swift'), directory)
project = Xcodeproj::Project.new(File.join(directory, 'StoreScreenshots.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'StoreScreenshots', :ios, '16.4', nil, :swift)
target.add_file_references([project.main_group.new_file('StoreScreenshots.swift')])
target.build_configurations.each do |config|
  config.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.aouerjmobile.StoreScreenshots',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'SWIFT_VERSION' => '5.0',
    'CODE_SIGN_STYLE' => 'Manual',
    'CODE_SIGN_IDENTITY' => '-',
    'DEVELOPMENT_TEAM' => '',
    'TARGETED_DEVICE_FAMILY' => '1',
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.save_as(project.path, 'StoreScreenshots', true)
