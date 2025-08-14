# Overflow Faculty Scraper

**Universal university faculty directory scraper with intelligent email confidence scoring and profile link extraction.**

Building "Overflow" - an AI-assisted lead generation SAAS starting with music faculty for personal music teaching business, expanding to other demographics (therapists, coaches, healers) long-term.

## 🚀 Key Features

- ✅ **Universal Profile Link Extraction** - Extracts faculty profile URLs from any university architecture
- ✅ **Multi-Method Compatibility** - Works across different university website structures  
- ✅ **Email Confidence Scoring** - Intelligent 0-1.0 scale rating for email accuracy
- ✅ **Smart Quality Detection** - Automatically chooses best extraction method per site
- ✅ **Source Tracking** - name-matched, proximity-fallback, none classifications
- ✅ **Automatic Pagination** - Handles multi-page faculty directories
- ✅ **Clean Data Output** - Structured JSON with complete faculty information

## 🏛️ Supported University Architectures

### Method 1: Kansas-style (Structured HTML)
- **Pattern**: CSS classes like `.views-row`
- **Use Case**: Modern university websites with structured markup
- **Example**: University of Kansas

### Method 2: Illinois-style (Text Pattern Matching)  
- **Pattern**: Line-by-line text parsing with email proximity detection
- **Use Case**: Plain text or simple HTML faculty listings
- **Example**: University of Illinois
- **Enhancement**: Now extracts profile links via universal link detection

### Method 3: Utah-style (Table/Markdown Layout)
- **Pattern**: Table-based layouts with embedded profile links
- **Use Case**: Structured tables with mailto: links
- **Example**: University of Utah

### Method 4: Tabular (UNF-style)
- **Pattern**: Table rows with structured cells (name, title, email, phone)
- **Use Case**: Database-style faculty directories
- **Example**: University of North Florida

## 📊 Data Output Format

```json
{
  "name": "Faculty Name",
  "titles": ["Professor of Music", "Department Chair"],
  "profileLink": "https://university.edu/people/faculty-name",
  "email": "faculty@university.edu",
  "emailConfidence": 0.95,
  "emailSource": "name-matched",
  "phone": "(555) 123-4567",
  "bio": "",
  "socials": {
    "youtube": "",
    "facebook": "",
    "instagram": "",
    "reddit": "",
    "linkedin": "",
    "tiktok": ""
  },
  "university": "University Name",
  "department": "School of Music",
  "sourceUrl": "https://university.edu/faculty/",
  "scrapedAt": "2025-08-14T16:50:28.479Z"
}
```

## 🎯 Email Confidence Scoring

| Score | Criteria | Example |
|-------|----------|---------|
| **0.95** | Perfect name match | `john.smith@university.edu` for "John Smith" |
| **0.85** | First name + last initial | `john.s@university.edu` for "John Smith" |
| **0.75** | Unique first name match | `bartholomew@university.edu` for "Bartholomew Jones" |
| **0.70** | Unique last name match | `van.beethoven@university.edu` for "Ludwig van Beethoven" |
| **0.50** | Partial name match | `j.smith@university.edu` for "John Smith" |
| **0.10** | No name correlation | Generic or unrelated email |

## 🧪 Testing Results

### Phase A Testing (Current)
- ✅ **University of Kansas**: 66 faculty - Method 1 (Kansas-style)
- ✅ **University of Illinois**: 77 faculty - Method 2 (Illinois-style)  
- ✅ **University of Utah**: 90+ faculty - Method 3 (Utah-style) - Perfect profile links
- ✅ **University of North Florida**: 18 faculty - Method 4 (Tabular)
- ✅ **University of South Carolina**: Faculty extracted - Method 2 with universal profile links

### Success Metrics
- **Overall Success Rate**: 100% on tested universities
- **Profile Link Extraction**: 100% success with universal system
- **Data Quality**: Clean names, emails, phones in correct fields
- **Speed**: 3-8 seconds per university page
- **Cost**: ~$50-100/month (Apify + existing stack)

## 🔧 Technical Architecture

### Universal Profile Link System
```javascript
// Extracts ALL profile links at page load
const allProfileLinks = extractAllProfileLinks($, baseUrl);

// Intelligent name-to-URL matching
const profileLink = findProfileLink(facultyName, allProfileLinks);
```

### Smart Method Selection
- Runs all 4 methods on each university
- Compares data quality (bad name rate, profile link rate)
- Automatically selects best results
- Logs decision for debugging

### Quality Assurance
- Detects phone numbers as names (indicates parsing errors)
- Validates email formats and university domains  
- Filters out navigation links and system text
- Deduplicates across multiple extraction methods

## 🗺️ Roadmap

### Phase A: Testing (Current)
**Target**: 70-80% success rate across diverse university architectures

**Batch 1 - State Universities**:
- Utah ✅, Indiana, Tampa, Michigan

**Batch 2 - Private Universities**:  
- Miami, Northwestern, Yale, Berklee

**Batch 3 - Different Platforms**:
- South Carolina ✅, Ball State, Michigan State, North Florida ✅

### Phase B: Make.com Integration
- Connect to existing workflow automation
- Google Sheets data staging
- Notion CRM integration

### Phase C: Enhanced Adaptability  
- Edge case handling
- Performance optimization
- Additional data fields

### Phase D: Scale to Other Demographics
- Therapists, coaches, healers
- Universal professional directory scraping

## 📈 Version History

- **v2.0** (Current): Universal Profile Link Extraction - Works across all university architectures
- **v1.4**: Method 4 (Tabular) + Smart quality comparison  
- **v1.3**: Email confidence scoring + source tracking
- **v1.2**: Universal compatibility across Kansas/Illinois/Utah styles
- **v1.1**: Utah architecture support + pagination
- **v1.0**: Initial Kansas + Illinois support

## 🛠️ Tech Stack

- **Apify Cheerio Scraper**: Faculty directory scraping & data extraction
- **Make.com**: Workflow automation & data processing
- **Google Sheets**: Data staging & management  
- **Notion**: Lead tracking & CRM
- **OpenAI**: Content personalization & email generation
- **Gmail**: Automated email outreach

## 🎯 Business Impact

**Primary Goal**: Build lead generation for music faculty → personal music teaching business

**Expansion**: Scale to therapists, coaches, healers across multiple demographics

**Success Criteria**: 
- 70-80% university compatibility rate
- High-quality profile link extraction for downstream workflows
- Scalable to 100+ universities without manual configuration
