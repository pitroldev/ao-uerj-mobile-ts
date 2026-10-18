source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
ruby ">= 3.1.0"

# Exclude problematic versions of cocoapods and activesupport that causes build failures.
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
# Active Support 7.2.3.1 and Concurrent Ruby 1.3.7 fix the Dependabot advisories
# (GHSA-2j26-frm8-cmj9, GHSA-cg4j-q9v8-6v38, GHSA-89vf-4333-qx8v and
# GHSA-h8w8-99g7-qmvj, GHSA-6wx8-w4f5-wwcr, GHSA-wv3x-4vxv-whpp). Active Support
# 7.2 needs Ruby 3.1 and loads logger itself, so the old concurrent-ruby
# < 1.3.4 pin from the React Native template is no longer needed.
gem 'activesupport', '>= 7.2.3.1'
gem 'xcodeproj', '< 1.26.0'
gem 'concurrent-ruby', '>= 1.3.7'

# Ruby 3.4.0 has removed some libraries from the standard library.
gem 'bigdecimal'
gem 'logger'
gem 'benchmark'
gem 'mutex_m'
gem 'nkf'
