source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
ruby ">= 2.6.10"

# Cocoapods 1.15 introduced a bug which break the build. We will remove the upper
# bound in the template on Cocoapods with next React Native release.
gem 'cocoapods', '>= 1.13', '< 1.15'
gem 'activesupport', '>= 6.1.7.5', '< 7.1.0'
# Works around a Ruby 2.6 / activesupport 6.1 require-order bug: activesupport's
# logger_thread_safe_level.rb references Logger before anything has required
# it. Pinning this here forces bundler to load a modern `logger` gem first.
gem 'logger'
