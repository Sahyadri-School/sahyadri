# FILE: check_external_links.rb — CI helper, used only by the weekly
# external-links workflow (see .github/workflows/external-links.yml).
# PURPOSE: Same idea as check_links.rb (which loads .htmlproofer.yml
# explicitly, since the plain CLI does not auto-discover a config file
# with that filename), but pointed at .htmlproofer-external.yml instead
# -- the config that actually checks external URLs, deliberately kept
# separate from the one that runs on every push.
require "html-proofer"
require "yaml"

config = YAML.load_file(File.join(__dir__, ".htmlproofer-external.yml"))

def to_regexp(str)
  if str.start_with?("/") && str.end_with?("/") && str.length > 1
    Regexp.new(str[1..-2])
  else
    str
  end
end

options = {
  disable_external: config["disable_external"],
  allow_hash_href: config["allow_hash_href"],
  ignore_urls: (config["ignore_urls"] || []).map { |u| to_regexp(u) },
  ignore_files: (config["ignore_files"] || []).map { |f| to_regexp(f) },
  checks: config["checks"] || ["Links"],
}

HTMLProofer.check_directory("./_site", options).run
