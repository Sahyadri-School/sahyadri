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

# html-proofer's Ruby API wants symbol keys for the HTTP-library settings.
def symbolize(hash)
  hash.each_with_object({}) { |(key, value), out| out[key.to_sym] = value }
end

options = {
  disable_external: config["disable_external"],
  allow_hash_href: config["allow_hash_href"],
  ignore_urls: (config["ignore_urls"] || []).map { |u| to_regexp(u) },
  ignore_files: (config["ignore_files"] || []).map { |f| to_regexp(f) },
  checks: config["checks"] || ["Links"],
}

# Only the keys listed above used to be passed on, so adding anything else to
# .htmlproofer-external.yml was silently ignored. These three are passed on
# when present (see that file for what they do and why):
#   ignore_status_codes -- reply codes not to report as failures
#   typhoeus            -- per-request settings (timeouts) for the HTTP library
#   hydra               -- how many requests run at once
# Left out of the YAML, html-proofer's own defaults apply, exactly as before.
options[:ignore_status_codes] = config["ignore_status_codes"] if config["ignore_status_codes"]
options[:typhoeus] = symbolize(config["typhoeus"]) if config["typhoeus"]
options[:hydra] = symbolize(config["hydra"]) if config["hydra"]

HTMLProofer.check_directory("./_site", options).run
