# overflow-faculty-scraper-apify-1
Universal university faculty directory scraper with confidence scoring
# Overflow Faculty Scraper

Universal university faculty directory scraper with intelligent email confidence scoring.

## Features
- ✅ Universal compatibility across different university website architectures
- ✅ Email confidence scoring (0-1.0 scale)
- ✅ Source tracking (name-matched, proximity-fallback, none)
- ✅ Support for Kansas, Illinois, and Utah-style faculty pages
- ✅ Automatic pagination handling
- ✅ Clean, structured data output

## Supported University Architectures
1. **Kansas-style**: Structured HTML with CSS classes (.views-row)
2. **Illinois-style**: Text-based pattern matching
3. **Utah-style**: Table-based layouts with profile links

## Data Output Format
```json
{
  "name": "Faculty Name",
  "titles": ["Professor of Music"],
  "email": "faculty@university.edu",
  "emailConfidence": 0.95,
  "emailSource": "name-matched",
  "profileLink": "https://university.edu/faculty/profile",
  "university": "University Name",
  "department": "School of Music"
}
Testing Results

✅ University of Kansas: 66 faculty
✅ University of Illinois: 77 faculty
✅ University of Utah: 90 faculty

Version History

v1.3: Email confidence scoring + source tracking
v1.2: Universal compatibility
v1.1: Utah architecture support
v1.0: Initial Kansas + Illinois support
