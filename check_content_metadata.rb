#!/usr/bin/env ruby
# Informational content audit for Google Drive media IDs.
# Warnings are deliberately non-blocking: reused images and legacy metadata
# may be intentional, and this script cannot verify Drive sharing permissions.
ROOT = File.expand_path(__dir__)
COLLECTIONS = %w[_posts _activities _profiles _photos _videos _kfi].freeze
ID_FIELDS = %w[image image_id drive_id profile-image profile_image thumbnail].freeze
ID_PATTERN = /\A[A-Za-z0-9_-]{10,}\z/

files = COLLECTIONS.flat_map { |dir| Dir.glob(File.join(ROOT, dir, '**', '*.md')) }
warnings = []
thumbnail_owners = Hash.new { |hash, key| hash[key] = [] }

files.each do |path|
  source = File.read(path, encoding: 'UTF-8')
  front_matter = source.match(/\A---\s*\n(.*?)\n---\s*(?:\n|\z)/m)
  next unless front_matter

  front_matter[1].each_line do |line|
    match = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/)
    next unless match && ID_FIELDS.include?(match[1])

    field = match[1]
    value = match[2].sub(/\s+#.*\z/, '').strip.sub(/\A['"]/, '').sub(/['"]\z/, '')
    next if value.empty? || value == 'null' || value == '~'

    relative = path.delete_prefix("#{ROOT}/")
    unless ID_PATTERN.match?(value)
      warnings << "#{relative}: #{field} should be a Google Drive file ID, not a full URL or other text"
      next
    end

    # Compare only primary thumbnails; gallery images may intentionally repeat.
    thumbnail_owners[value] << relative if %w[image image_id drive_id thumbnail].include?(field)
  end
end

thumbnail_owners.each do |id, owners|
  next if owners.uniq.length < 2

  warnings << "Repeated thumbnail ID #{id}: #{owners.uniq.join(', ')}"
end

puts "Content metadata audit: scanned #{files.length} content files."
if warnings.empty?
  puts 'No suspicious media IDs or repeated thumbnail IDs found.'
else
  puts "Found #{warnings.length} warning(s); these are advisory and do not block deployment:"
  warnings.each { |warning| puts "  - #{warning}" }
end
