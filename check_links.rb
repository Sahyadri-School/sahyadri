# FILE: check_links.rb — CI helper.
# PURPOSE: Runs html-proofer against the built _site output, explicitly
# loading .htmlproofer.yml (the CLI's plain `htmlproofer ./_site` does NOT
# auto-discover this file, despite the filename matching that convention --
# confirmed by CI actually running Images checks and hitting external URLs
# even though the config disables both). This script loads the YAML by
# hand, converts its string-encoded regex patterns (e.g. "/^#/") into real
# Ruby Regexp objects, and passes everything to HTMLProofer explicitly.
require "html-proofer"
require "yaml"

config = YAML.load_file(File.join(__dir__, ".htmlproofer.yml"))

# Converts a "/pattern/" string (as written in the YAML file) into a real
# Regexp. Leaves already-plain strings alone, just in case.
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

# Guard: template code must never reach a meta tag (link previews and search snippets read these).
# A page that begins with template code and has no share-description: used to show that code as its
# description. _includes/head.html now falls back to the site description, so this should never trigger;
# it exists so that, if it ever does, the build fails with a clear message instead of publishing it.
leaks = []
Dir.glob("./_site/**/*.html").each do |path|
  File.read(path, encoding: "UTF-8").scan(/<meta\b[^>]*\bcontent="([^"]*)"/m).flatten.each do |content|
    leaks << path if content.include?("{%") || content.include?("{{")
  end
end
unless leaks.empty?
  warn "Template code leaked into meta tags (link previews / search snippets) on:"
  leaks.uniq.each { |path| warn "  #{path.sub('./_site', '')}" }
  warn "Give each of these pages a share-description: line in its front matter."
  exit 1
end

HTMLProofer.check_directory("./_site", options).run
