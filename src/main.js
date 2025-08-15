// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/)
import { Actor } from 'apify';
// Crawlee - web scraping and browser automation library (Read more at https://crawlee.dev)
import { CheerioCrawler, Dataset } from 'crawlee';
// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
// import { router } from './routes.js';

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init()
await Actor.init();

// Structure of input is defined in input_schema.json
const { startUrls = ['https://apify.com'], maxRequestsPerCrawl = 100 } = (await Actor.getInput()) ?? {};

const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new CheerioCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl,
    async requestHandler({ enqueueLinks, request, $, log }) {
        log.info(`Scraping: ${request.loadedUrl}`);
        // DIAGNOSTIC TEST - Add this BEFORE your existing methods to see the HTML structure
        // This will help us understand the exact layout

        log.info('=== ILLINOIS DIAGNOSTIC TEST ===');

        // Test 1: Look for faculty card containers
        const possibleContainers = [
            '.faculty-card', '.faculty-member', '.person-card', '.profile-card',
            '.faculty-profile', '.directory-entry', '.people-card', '.staff-card',
            '[class*="faculty"]', '[class*="person"]', '[class*="profile"]'
        ];

        possibleContainers.forEach(selector => {
            const found = $(selector);
            if (found.length > 0) {
                log.info(`Found ${found.length} elements with selector: ${selector}`);
                
                // Log the first few elements
                found.slice(0, 3).each(function(index) {
                    log.info(`Sample ${selector} #${index}:`, $(this).html().substring(0, 200));
                });
            }
        });

        // Test 2: Look for elements containing email patterns
        log.info('\n=== ELEMENTS WITH EMAIL PATTERNS ===');
        $('*').each(function() {
            const text = $(this).text();
            if (text.includes('@illinois.edu') && text.length < 200) {
                const tagName = this.tagName.toLowerCase();
                const className = $(this).attr('class') || '';
                const parent = $(this).parent()[0]?.tagName?.toLowerCase() || '';
                
                log.info(`Email found in <${tagName}> (class: ${className}, parent: ${parent}):`, text.trim());
                log.info(`HTML:`, $(this).html().substring(0, 150));
                log.info('---');
            }
        });

        // Test 3: Look for faculty names (proper names with links)
        log.info('\n=== FACULTY NAME LINKS ===');
        $('a').each(function() {
            const linkText = $(this).text().trim();
            const href = $(this).attr('href');
            
            // Check if this looks like a faculty name link
            if (href && href.includes('/people/profiles/') && linkText.length > 5 && linkText.length < 50) {
                const parent = $(this).parent();
                const parentClass = parent.attr('class') || '';
                const container = parent.parent();
                const containerClass = container.attr('class') || '';
                
                log.info(`Faculty link: "${linkText}" -> ${href}`);
                log.info(`Parent: <${parent[0]?.tagName?.toLowerCase()}> class="${parentClass}"`);
                log.info(`Container: <${container[0]?.tagName?.toLowerCase()}> class="${containerClass}"`);
                log.info(`Full container text:`, container.text().substring(0, 200));
                log.info('---');
                
                // Only log first 5 to avoid spam
                if ($('a[href*="/people/profiles/"]').index(this) >= 4) {
                    return false;
                }
            }
        });

        // Test 4: Find the faculty grid/container structure
        log.info('\n=== FACULTY GRID STRUCTURE ===');
        const gridSelectors = ['.grid', '.row', '.columns', '.faculty-grid', '.directory-grid', '.people-grid', '[class*="grid"]', '[class*="row"]'];

        gridSelectors.forEach(selector => {
            const found = $(selector);
            if (found.length > 0) {
                log.info(`Found ${found.length} ${selector} elements`);
                found.each(function() {
                    const profileLinks = $(this).find('a[href*="/people/profiles/"]').length;
                    const emails = $(this).text().match(/@illinois\.edu/g)?.length || 0;
                    
                    if (profileLinks > 0 || emails > 0) {
                        log.info(`  ${selector} contains ${profileLinks} profile links and ${emails} emails`);
                        log.info(`  Classes: ${$(this).attr('class') || 'none'}`);
                        log.info(`  First 150 chars:`, $(this).text().substring(0, 150));
                    }
                });
            }
        });

        // Test 5: Check for specific Illinois patterns based on your screenshot
        log.info('\n=== LOOKING FOR ILLINOIS-SPECIFIC PATTERNS ===');

        // Check for common faculty directory patterns
        const patterns = [
            'div[class*="view"]',  // Drupal views
            'div[class*="person"]',
            'div[class*="faculty"]',
            '.field-content',
            '.views-row',
            '.node-person'
        ];

        patterns.forEach(selector => {
            const found = $(selector);
            if (found.length > 0) {
                found.each(function() {
                    const text = $(this).text();
                    if (text.includes('@illinois.edu')) {
                        log.info(`${selector} with email:`, text.substring(0, 200));
                        log.info(`HTML structure:`, $(this).html().substring(0, 200));
                        log.info('---');
                    }
                });
            }
        });

        log.info('=== END DIAGNOSTIC TEST ===\n');

// Helper function to get base URL for relative links
function getBaseUrl(url) {
    try {
        const urlObj = new URL(url);
        return `${urlObj.protocol}//${urlObj.host}`;
    } catch (e) {
        return url.split('/').slice(0, 3).join('/');
    }
}

// UNIVERSAL PROFILE LINK EXTRACTOR - Works for all sites
function extractAllProfileLinks($, baseUrl) {
    const profileLinks = {};
    
    log.info('Extracting all profile links from page...');
    
    $('a').each(function() {
        const href = $(this).attr('href');
        const linkText = $(this).text().trim();
        
        if (href && linkText && linkText.length > 2 && linkText.length < 100) {
            // Skip obvious navigation/system links
            if (linkText.includes('Home') || linkText.includes('Contact') || 
                linkText.includes('About') || linkText.includes('Search') ||
                linkText.includes('Login') || linkText.includes('Menu') ||
                linkText.includes('Next') || linkText.includes('Previous') ||
                linkText.includes('View all') || linkText.includes('More')) {
                return;
            }
            
            // Convert relative URLs to absolute
            const fullUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
            
            // Store original format
            profileLinks[linkText] = fullUrl;
            
            // Handle "Last, First" format (common in faculty directories)
            if (linkText.includes(',')) {
                const nameParts = linkText.split(',').map(part => part.trim());
                if (nameParts.length === 2) {
                    const firstName = nameParts[1];
                    const lastName = nameParts[0];
                    const fullName = `${firstName} ${lastName}`.trim();
                    profileLinks[fullName] = fullUrl;
                }
            }
            
            // Handle "First Last" format by creating variations
            const words = linkText.split(' ').filter(word => word.length > 1);
            if (words.length >= 2 && words.length <= 4) {
                // Create "Last, First" variation
                if (words.length === 2) {
                    const lastFirstFormat = `${words[1]}, ${words[0]}`;
                    profileLinks[lastFirstFormat] = fullUrl;
                }
            }
        }
    });
    
    log.info(`Found ${Object.keys(profileLinks).length} potential profile links`);
    return profileLinks;
}

// Helper function to find best matching profile link
function findProfileLink(name, allProfileLinks) {
    // Try exact match first
    if (allProfileLinks[name]) {
        return allProfileLinks[name];
    }
    
    // Try case-insensitive exact match
    const lowerName = name.toLowerCase();
    for (const [linkName, url] of Object.entries(allProfileLinks)) {
        if (linkName.toLowerCase() === lowerName) {
            return url;
        }
    }
    
    // Try partial matching - both directions
    for (const [linkName, url] of Object.entries(allProfileLinks)) {
        const lowerLinkName = linkName.toLowerCase();
        
        // Check if link name contains our name or vice versa
        if (lowerLinkName.includes(lowerName) || lowerName.includes(lowerLinkName)) {
            return url;
        }
        
        // Check individual name parts
        const nameWords = lowerName.split(' ').filter(word => word.length > 2);
        const linkWords = lowerLinkName.split(/[, ]/).filter(word => word.length > 2);
        
        let matchCount = 0;
        for (const nameWord of nameWords) {
            for (const linkWord of linkWords) {
                if (nameWord === linkWord || nameWord.includes(linkWord) || linkWord.includes(nameWord)) {
                    matchCount++;
                    break;
                }
            }
        }
        
        // If most name parts match, consider it a good match
        if (matchCount >= Math.min(nameWords.length, 2)) {
            return url;
        }
    }
    
    return '';
}

// Helper function to find email specifically for this faculty member
function findFacultyEmail(name, $facultySection) {
    let bestEmail = '';
    let highestConfidence = 0;
    
    // Look for emails within this faculty member's specific section
    $facultySection.find('a[href^="mailto:"]').each(function() {
        const emailHref = $(this).attr('href');
        if (emailHref) {
            const cleanEmail = emailHref.replace('mailto:', '').split('?')[0].trim();
            const confidence = calculateEmailConfidence(name, cleanEmail);
            
            // Only use emails with reasonable confidence (>0.3)
            if (confidence > highestConfidence && confidence > 0.3) {
                bestEmail = cleanEmail;
                highestConfidence = confidence;
            }
        }
    });
    
    return { email: bestEmail, confidence: highestConfidence };
}

// Helper function to calculate email confidence score
function calculateEmailConfidence(name, email) {
    if (!email || !name) return 0;
    
    const firstName = name.split(' ')[0].toLowerCase();
    const lastName = name.split(' ').length > 1 ? name.split(' ')[name.split(' ').length - 1].toLowerCase() : '';
    const emailLower = email.toLowerCase();
    
    let score = 0;
    
    // Perfect match patterns
    if (emailLower.includes(`${firstName}.${lastName}`) || 
        emailLower.includes(`${lastName}.${firstName}`) ||
        emailLower.startsWith(`${firstName}.${lastName}`) ||
        emailLower.startsWith(`${lastName}.${firstName}`)) {
        score = 0.95;
    }
    // First name + last initial
    else if (lastName && emailLower.includes(`${firstName}.${lastName.charAt(0)}`)) {
        score = 0.85;
    }
    // Just first name (if unique/long)
    else if (emailLower.includes(firstName) && firstName.length > 5) {
        score = 0.75;
    }
    // Just last name (if unique/long)
    else if (lastName && emailLower.includes(lastName) && lastName.length > 5) {
        score = 0.7;
    }
    // Partial match
    else if (emailLower.includes(firstName) || (lastName && emailLower.includes(lastName))) {
        score = 0.5;
    }
    // No match
    else {
        score = 0.1;
    }
    
    return score;
}

// Helper function to extract and categorize social media links
function extractSocials($) {
    const socials = {
        youtube: '',
        facebook: '',
        instagram: '',
        reddit: '',
        linkedin: '',
        tiktok: ''
    };
    
    // Look for social media links in the page
    $('a').each(function() {
        const href = $(this).attr('href');
        if (!href) return;
        
        const url = href.toLowerCase();
        
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            socials.youtube = href;
        } else if (url.includes('facebook.com') || url.includes('fb.com')) {
            socials.facebook = href;
        } else if (url.includes('instagram.com')) {
            socials.instagram = href;
        } else if (url.includes('reddit.com')) {
            socials.reddit = href;
        } else if (url.includes('linkedin.com')) {
            socials.linkedin = href;
        } else if (url.includes('tiktok.com')) {
            socials.tiktok = href;
        }
    });
    
    return socials;
}

// Helper function to extract university name from URL
function getUniversityName(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        const parts = hostname.split('.');
        
        // Common university domain mappings
        const universityMap = {
            'utah.edu': 'University of Utah',
            'indiana.edu': 'Indiana University',
            'usf.edu': 'University of South Florida', 
            'umich.edu': 'University of Michigan',
            'ku.edu': 'University of Kansas',
            'illinois.edu': 'University of Illinois',
            'miami.edu': 'University of Miami',
            'northwestern.edu': 'Northwestern University',
            'yale.edu': 'Yale University',
            'berklee.edu': 'Berklee College of Music',
            'unf.edu': 'University of North Florida',
            'sc.edu': 'University of South Carolina',
            'music.utah.edu': 'University of Utah',
            'music.indiana.edu': 'Indiana University',
            'music.illinois.edu': 'University of Illinois',
            'music.ku.edu': 'University of Kansas'
        };
        
        // Check for exact hostname match first
        if (universityMap[hostname]) {
            return universityMap[hostname];
        }
        
        // Check for domain match
        const domain = parts.slice(-2).join('.');
        if (universityMap[domain]) {
            return universityMap[domain];
        }
        
        // Fallback: capitalize the main domain part
        const mainDomain = parts[parts.length - 2];
        return `${mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)} University`;
        
    } catch (e) {
        return 'Unknown University';
    }
}

// Helper function to dynamically detect department from URL and page content
function getDepartmentName(url, $) {
    try {
        // First check URL patterns
        const urlLower = url.toLowerCase();
        
        if (urlLower.includes('/music/')) {
            return 'School of Music';
        } else if (urlLower.includes('/arts/')) {
            return 'School of Arts';
        } else if (urlLower.includes('/theater/') || urlLower.includes('/theatre/')) {
            return 'Department of Theater';
        } else if (urlLower.includes('/dance/')) {
            return 'Department of Dance';
        } else if (urlLower.includes('/psychology/')) {
            return 'Department of Psychology';
        } else if (urlLower.includes('/counseling/')) {
            return 'Department of Counseling';
        } else if (urlLower.includes('/therapy/')) {
            return 'Department of Therapy';
        }
        
        // Then check page content for department indicators
        const pageText = $('body').text().toLowerCase();
        const titleText = $('title').text().toLowerCase();
        const h1Text = $('h1').first().text().toLowerCase();
        
        // Check all text sources
        const allText = `${pageText} ${titleText} ${h1Text}`;
        
        // Music-related patterns
        if (allText.includes('school of music') || allText.includes('college of music')) {
            return allText.includes('college of music') ? 'College of Music' : 'School of Music';
        } else if (allText.includes('conservatory')) {
            return 'Conservatory';
        } else if (allText.includes('department of music')) {
            return 'Department of Music';
        } else if (allText.includes('music faculty') || allText.includes('music department')) {
            return 'School of Music';
        }
        
        // Arts-related patterns
        else if (allText.includes('school of arts') || allText.includes('college of arts')) {
            return allText.includes('college of arts') ? 'College of Arts' : 'School of Arts';
        } else if (allText.includes('fine arts')) {
            return 'School of Fine Arts';
        } else if (allText.includes('performing arts')) {
            return 'School of Performing Arts';
        }
        
        // Psychology/Therapy patterns (for your future expansion)
        else if (allText.includes('school of psychology') || allText.includes('department of psychology')) {
            return allText.includes('school of psychology') ? 'School of Psychology' : 'Department of Psychology';
        } else if (allText.includes('counseling')) {
            return 'Department of Counseling';
        } else if (allText.includes('therapy')) {
            return 'Department of Therapy';
        }
        
        // Theater/Dance patterns
        else if (allText.includes('theater') || allText.includes('theatre')) {
            return 'Department of Theater';
        } else if (allText.includes('dance')) {
            return 'Department of Dance';
        }
        
        // Default fallback - still music-focused for your current use case
        return 'School of Music';
        
    } catch (e) {
        return 'School of Music'; // Safe fallback
    }
}

const facultyData = [];
const seenFaculty = new Set();

// EXTRACT ALL PROFILE LINKS AT THE START - Universal for all methods
const baseUrl = getBaseUrl(request.loadedUrl);
const allProfileLinks = extractAllProfileLinks($, baseUrl);

// Extract social media links once for the entire page
const pageSocials = extractSocials($);

// Method 1: Kansas-style (structured HTML)
$('.views-row').each(function() {
    const $row = $(this);
    const nameElement = $row.find('a').first();
    const name = nameElement.text().trim();
    
    if (!name || name.includes('View full profile') || name.length < 3) {
        return;
    }
    
    // Skip obvious non-faculty entries
    if (name.includes('String Quartet') || 
        name.includes('Affiliated faculty') || 
        name.toLowerCase().includes('ensemble')) {
        return; // Skip this entry
    }
    
    // Use universal profile link finder
    const profileLink = findProfileLink(name, allProfileLinks);
    
    const titles = [];
    $row.find('li').each(function() {
        const titleText = $(this).text().trim();
        if (titleText && !titleText.includes('View full profile')) {
            titles.push(titleText);
        }
    });
    
    // Check titles for ensemble/group patterns
    if (titles.some(title => title.includes('Group') || title.includes('Quartet'))) {
        return; // Skip this entry
    }
    
    const uniqueId = `${name}-${profileLink}`;
    if (!seenFaculty.has(uniqueId)) {
        seenFaculty.add(uniqueId);
        facultyData.push({
            name: name,
            titles: titles,
            profileLink: profileLink,
            email: '',
            emailConfidence: 0,
            emailSource: 'none',
            phone: '',
            bio: '',
            socials: {
                youtube: '',
                facebook: '',
                instagram: '',
                reddit: '',
                linkedin: '',
                tiktok: ''
            },
            university: getUniversityName(request.loadedUrl),
            department: getDepartmentName(request.loadedUrl, $),
            sourceUrl: request.loadedUrl,
        });
    }
});

// Enhanced Method 2 for Illinois - Add this BEFORE your Method 2 section
async function extractMethod2Illinois($, { request, log }) {
    console.log('🔍 Starting enhanced Illinois Method 2 debugging...');
    
    // Step 1: Enhanced card detection using diagnostic insights
    const facultyCards = $('div[class*="person"]');
    console.log(`✅ Found ${facultyCards.length} cards using person selector`);
    
    if (facultyCards.length === 0) {
        console.log('❌ No faculty cards found');
        return [];
    }
    
    console.log(`🎯 Processing ${facultyCards.length} cards`);
    
    const results = [];
    
    // Step 2: Process each card based on diagnostic findings
    facultyCards.each(function(i) {
        console.log(`\n--- Processing Card ${i + 1}/${facultyCards.length} ---`);
        
        const $card = $(this);
        const cardText = $card.text();
        
        // Step 3: Extract name from profile link (most reliable based on diagnostic)
        const $nameLink = $card.find('a[href*="/people/profiles/"]').first();
        const name = $nameLink.text().trim();
        
        // Skip if no valid name
        if (!name || name.length < 3 || name.length > 50) {
            console.log(`⚠️  Card ${i + 1}: Skipping - invalid name "${name}"`);
            return true; // continue to next iteration
        }
        
        console.log(`👤 Card ${i + 1}: Name = "${name}"`);
        
        // Step 4: Extract email using diagnostic-found structure
        let email = '';
        let emailConfidence = 0;
        let emailSource = 'none';
        
        // Strategy A: mailto links (most reliable from diagnostic)
        const $mailtoLink = $card.find('a[href^="mailto:"]').first();
        if ($mailtoLink.length > 0) {
            email = $mailtoLink.attr('href').replace('mailto:', '').trim();
            emailConfidence = calculateEmailConfidence(name, email);
            emailSource = 'mailto-link';
            console.log(`📧 Card ${i + 1}: Found mailto = "${email}" (confidence: ${emailConfidence})`);
        }
        
        // Strategy B: Email in contact sections (.profile-card__contact-email classes)
        if (!email) {
            const $emailElements = $card.find('.profile-card__contact-email, .profile-card__contact-email-link');
            if ($emailElements.length > 0) {
                const emailText = $emailElements.first().text().trim();
                if (emailText.includes('@')) {
                    email = emailText;
                    emailConfidence = calculateEmailConfidence(name, email);
                    emailSource = 'contact-element';
                    console.log(`📧 Card ${i + 1}: Found contact element = "${email}" (confidence: ${emailConfidence})`);
                }
            }
        }
        
        // Strategy C: Email patterns in card text (fallback)
        if (!email) {
            const emailMatches = cardText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
            if (emailMatches && emailMatches.length > 0) {
                for (const potentialEmail of emailMatches) {
                    const confidence = calculateEmailConfidence(name, potentialEmail);
                    if (confidence > emailConfidence) {
                        email = potentialEmail;
                        emailConfidence = confidence;
                        emailSource = 'text-pattern';
                    }
                }
                console.log(`📧 Card ${i + 1}: Found text pattern = "${email}" (confidence: ${emailConfidence})`);
            }
        }
        
        // Step 5: Extract profile link
        const profileHref = $nameLink.attr('href');
        const baseUrl = 'https://music.illinois.edu';
        const profileLink = profileHref ? (profileHref.startsWith('http') ? profileHref : `${baseUrl}${profileHref}`) : '';
        console.log(`🔗 Card ${i + 1}: Profile = "${profileLink}"`);
        
        // Step 6: Extract titles from card structure
        const titles = [];
        
        // Look for title elements in card
        $card.find('.profile-card__title, .person-title, [class*="title"]').each(function() {
            const titleText = $(this).text().trim();
            if (titleText && titleText !== name && titleText.length > 3 && titleText.length < 100 &&
                !titleText.includes('@') && !titleText.includes('217-')) {
                titles.push(titleText);
            }
        });
        
        // Extract additional titles from text if needed
        if (titles.length === 0) {
            const lines = cardText.split('\n').map(line => line.trim()).filter(line => line);
            for (const line of lines) {
                if (line && line !== name && line.length > 5 && line.length < 100 &&
                    !line.includes('@') && !line.includes('217-') &&
                    (line.toLowerCase().includes('professor') || 
                     line.toLowerCase().includes('director') ||
                     line.toLowerCase().includes('chair') ||
                     line.toLowerCase().includes('instructor'))) {
                    
                    if (!titles.includes(line)) {
                        titles.push(line);
                    }
                }
            }
        }
        
        console.log(`🎓 Card ${i + 1}: Titles = [${titles.join(', ')}]`);
        
        // Step 7: Extract phone
        const phoneMatch = cardText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0].trim() : '';
        if (phone) console.log(`📞 Card ${i + 1}: Phone = "${phone}"`);
        
        // Step 8: Only include if email confidence is reasonable OR has academic titles
        const hasAcademicTitle = titles.some(title => 
            title.toLowerCase().includes('professor') ||
            title.toLowerCase().includes('instructor') ||
            title.toLowerCase().includes('lecturer') ||
            title.toLowerCase().includes('director') ||
            title.toLowerCase().includes('chair'));
        
        if (emailConfidence > 0.3 || hasAcademicTitle) {
            const finalEmail = emailConfidence > 0.3 ? email : '';
            const finalEmailSource = finalEmail ? emailSource : 'none';
            
            results.push({
                name: name,
                titles: titles.slice(0, 3), // Limit to first 3 titles
                profileLink: profileLink,
                email: finalEmail,
                emailConfidence: emailConfidence,
                emailSource: finalEmailSource,
                phone: phone,
                bio: '',
                socials: {
                    youtube: '',
                    facebook: '',
                    instagram: '',
                    reddit: '',
                    linkedin: '',
                    tiktok: ''
                },
                university: getUniversityName(context.request.loadedUrl),
                department: getDepartmentName(context.request.loadedUrl, $),
                sourceUrl: context.request.loadedUrl,
                scrapedAt: new Date().toISOString()
            });
            
            console.log(`✅ Card ${i + 1}: Added to results`);
        } else {
            console.log(`⚠️  Card ${i + 1}: Skipped - low email confidence (${emailConfidence}) and no academic titles`);
        }
    });
    
    console.log(`\n✅ Method 2 Illinois completed: ${results.length} faculty members extracted`);
    return results;
}

// Method 2: Detect Illinois card layout vs line-based layout
if (facultyData.length === 0) {
    // Check if this looks like Illinois card-based layout
    const hasPersonCards = $('div[class*="person"]').length > 5;
    const hasProfileLinks = $('a[href*="/people/profiles/"]').length > 5;
    
    if (hasPersonCards && hasProfileLinks) {
        log.info('Detected Illinois card-based layout, using ENHANCED card extraction method');
        
        // REPLACE OLD METHOD 2a WITH NEW ENHANCED VERSION
        const illinoisResults = await extractMethod2Illinois($, { request, log });
        
        // Add results to facultyData
        illinoisResults.forEach(faculty => {
            const uniqueId = `${faculty.name}-${faculty.email}-${faculty.profileLink}`;
            if (!seenFaculty.has(uniqueId)) {
                seenFaculty.add(uniqueId);
                facultyData.push(faculty);
            }
        });
        
    } else {
        log.info('Using line-by-line text parsing method for non-card layout');
        
        // Method 2b: Keep your existing line-by-line code for other universities
        const pageText = $('body').text();
        const lines = pageText.split('\n').map(line => line.trim()).filter(line => line && line.length > 1);
        
        for (let i = 0; i < lines.length - 1; i++) {
            const currentLine = lines[i];
            
            // Enhanced filtering to avoid junk entries
            if (currentLine && 
                !currentLine.includes('@') &&
                currentLine !== 'Faculty' &&
                currentLine !== 'Faculty Directory' &&
                currentLine !== 'Search faculty by name, title, or position' &&
                currentLine !== 'Clear input field' &&
                currentLine !== 'Featured Alumni' &&
                currentLine !== 'People' &&
                currentLine.length > 2 && 
                currentLine.length < 50 &&
                !currentLine.includes('217-') &&
                !currentLine.includes('music@illinois') &&
                !currentLine.includes('Previous') &&
                !currentLine.includes('Next') &&
                !currentLine.includes('Cookie') &&
                !currentLine.includes('Settings') &&
                !currentLine.includes('String Quartet') &&
                !currentLine.includes('Affiliated faculty') &&
                !currentLine.toLowerCase().includes('ensemble') &&
                !currentLine.toLowerCase().includes('alumni')) {
                
                const name = currentLine;
                
                // Look ahead for email and titles
                let titles = [];
                let searchText = '';
                
                for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                    const nextLine = lines[j];
                    searchText += ' ' + nextLine;
                    
                    if (nextLine.includes('@') && nextLine.includes('.edu')) {
                        break;
                    } else if (nextLine === 'Faculty') {
                        break;
                    } else if (nextLine && 
                              nextLine.length > 5 && 
                              !nextLine.includes('Faculty Directory') &&
                              !nextLine.includes('Search faculty')) {
                        titles.push(nextLine);
                    }
                }
                
                // Extract email using enhanced method
                const emailMatches = searchText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                let bestEmail = '';
                let bestConfidence = 0;
                
                if (emailMatches) {
                    for (const potentialEmail of emailMatches) {
                        if (!potentialEmail.includes('music@') && 
                            !potentialEmail.includes('info@') && 
                            !potentialEmail.includes('admin@') && 
                            !potentialEmail.includes('contact@')) {
                            
                            const confidence = calculateEmailConfidence(name, potentialEmail);
                            if (confidence > bestConfidence) {
                                bestEmail = potentialEmail;
                                bestConfidence = confidence;
                            }
                        }
                    }
                }
                
                if (bestEmail && bestConfidence > 0.3) {
                    const profileLink = findProfileLink(name, allProfileLinks);
                    const emailSource = bestConfidence > 0.7 ? 'name-matched' : 'section-matched';
                    
                    const uniqueId = `${name}-${bestEmail}`;
                    if (!seenFaculty.has(uniqueId)) {
                        seenFaculty.add(uniqueId);
                        facultyData.push({
                            name: name,
                            titles: titles.slice(0, 3),
                            profileLink: profileLink,
                            email: bestEmail,
                            emailConfidence: bestConfidence,
                            emailSource: emailSource,
                            phone: '',
                            bio: '',
                            socials: {
                                youtube: '',
                                facebook: '',
                                instagram: '',
                                reddit: '',
                                linkedin: '',
                                tiktok: ''
                            },
                            university: getUniversityName(request.loadedUrl),
                            department: getDepartmentName(request.loadedUrl, $),
                            sourceUrl: request.loadedUrl,
                            scrapedAt: new Date().toISOString()
                        });
                    }
                    
                    i = i + titles.length + 1;
                }
            }
        }
    }
}

// Method 3: Utah-style (table/markdown layout with links) - IMPROVED EMAIL MATCHING
if (facultyData.length === 0) {
    log.info('Trying Utah-style extraction method');
    
    // Extract all faculty links that look like profile pages
    $('a').each(function() {
        const href = $(this).attr('href');
        const name = $(this).text().trim();
        
        // Utah faculty links pattern: /faculty/name.php (but exclude directory/navigation pages)
        if (href && href.includes('/faculty/') && href.includes('.php') && 
            name && name.length > 2 && name.length < 50 &&
            !name.includes('Email') && !name.includes('Office') &&
            !name.includes('Next Steps') && !name.includes('View') &&
            !name.includes('Faculty Directory') && !name.includes('Resources') &&
            !name.includes('Open Positions') && !name.includes('Faculty by Area') &&
            !href.includes('index.php') && !href.includes('resources') &&
            !href.includes('open-positions') && !href.includes('faculty-area') &&
            !name.includes('String Quartet') &&
            !name.includes('Affiliated faculty') &&
            !name.toLowerCase().includes('ensemble')) {
            
            // Use universal profile link finder (more reliable than local extraction)
            const profileLink = findProfileLink(name, allProfileLinks);
            
            // Find the faculty member's section/container
            const $facultySection = $(this).closest('p, div, tr').parent();
            
            // Use the new findFacultyEmail function
            const emailResult = findFacultyEmail(name, $facultySection);
            const email = emailResult.confidence > 0.3 ? emailResult.email : '';
            const emailConfidence = emailResult.confidence;
            const emailSource = email ? (emailConfidence > 0.7 ? 'name-matched' : 'section-matched') : 'none';
            
            // Look for title information near this faculty link
            const $parentRow = $(this).closest('tr, p, div');
            let titles = [];
            
            // Get text content near the link and try to extract titles
            const nearbyText = $parentRow.text() || $(this).parent().text() || '';
            const textParts = nearbyText.split(name);
            
            if (textParts.length > 1) {
                // Text after the name is likely the title
                const afterName = textParts[1].trim();
                // Clean up the title text
                const cleanTitle = afterName
                    .replace(/^[^\w]*/, '') // Remove leading non-word chars
                    .replace(/Office:.*$/, '') // Remove office info
                    .replace(/Phone:.*$/, '') // Remove phone info
                    .replace(/Email.*$/, '') // Remove email info
                    .trim();
                
                if (cleanTitle && cleanTitle.length > 3 && cleanTitle.length < 100) {
                    titles.push(cleanTitle);
                }
            }
            
            // Check titles for ensemble/group patterns
            if (titles.some(title => title.includes('Group') || title.includes('Quartet'))) {
                return; // Skip this entry
            }
            
            const uniqueId = `${name}-${profileLink}`;
            if (!seenFaculty.has(uniqueId)) {
                seenFaculty.add(uniqueId);
                facultyData.push({
                    name: name,
                    titles: titles,
                    profileLink: profileLink,
                    email: email,
                    emailConfidence: emailConfidence,
                    emailSource: emailSource,
                    phone: '',
                    bio: '',
                    socials: {
                        youtube: '',
                        facebook: '',
                        instagram: '',
                        reddit: '',
                        linkedin: '',
                        tiktok: ''
                    },
                    university: getUniversityName(request.loadedUrl),
                    department: getDepartmentName(request.loadedUrl, $),
                    sourceUrl: request.loadedUrl,
                    scrapedAt: new Date().toISOString()
                });
            }
        }
    });
}

// Method 4: Tabular faculty directory (UNF style) - IMPROVED EMAIL MATCHING
if (true) {
    log.info('Trying tabular extraction method (UNF style)');
    
    let tabularResults = [];
    const seenTabular = new Set();
    
    // Look for faculty in table rows or structured containers
    $('tr, .faculty-row, .faculty-member, .directory-row').each(function() {
        // Extract name from link text
        const nameLink = $(this).find('a').first();
        const name = nameLink.text().trim();
        
        // Skip if no name or obvious non-faculty entries
        if (!name || name.length < 3 || name.length > 50 ||
            name.includes('Email') || name.includes('Phone') ||
            name.includes('Office') || name.includes('Room') ||
            name.includes('Directory') || name.includes('Faculty') ||
            name.includes('String Quartet') ||
            name.includes('Affiliated faculty') ||
            name.toLowerCase().includes('ensemble')) {
            return;
        }
        
        // Use universal profile link finder
        const profileLink = findProfileLink(name, allProfileLinks);
        
        // Extract email, phone, title from structured cells or nearby text
        const cells = $(this).find('td, .cell, .info');
        let email = '';
        let phone = '';
        let titles = [];
        
        // Method A: Look in table cells with better email matching
        cells.each(function() {
            const cellText = $(this).text().trim();
            
            // Check for email pattern with confidence scoring
            if (cellText.includes('@') && cellText.includes('.edu')) {
                const confidence = calculateEmailConfidence(name, cellText);
                if (confidence > 0.3 && (!email || confidence > calculateEmailConfidence(name, email))) {
                    email = cellText;
                }
            }
            
            // Check for phone pattern
            const phoneMatch = cellText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            if (phoneMatch) {
                phone = phoneMatch[0];
            }
            
            // Check for title (not email, phone, or name)
            if (cellText && !cellText.includes('@') && !phoneMatch && 
                cellText !== name && cellText.length > 5 && cellText.length < 100) {
                titles.push(cellText);
            }
        });
        
        // Method B: Look in all text content of the row if cells didn't work
        if (!email || titles.length === 0) {
            const rowText = $(this).text();
            
            // Enhanced email search using broader matching
            const emailMatches = rowText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
            if (emailMatches && !email) {
                let bestConfidence = 0;
                for (const potentialEmail of emailMatches) {
                    const confidence = calculateEmailConfidence(name, potentialEmail);
                    if (confidence > bestConfidence) {
                        email = potentialEmail;
                        bestConfidence = confidence;
                    }
                }
                // Only use if confidence is reasonable
                if (bestConfidence <= 0.3) {
                    email = '';
                }
            }
            
            // Extract phone
            const phoneMatch = rowText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            if (phoneMatch && !phone) {
                phone = phoneMatch[0];
            }
            
            // Extract title by removing name, email, phone from row text
            let cleanedText = rowText.replace(name, '').replace(email, '').replace(phone, '');
            cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
            
            if (cleanedText && cleanedText.length > 5 && cleanedText.length < 100) {
                titles.push(cleanedText);
            }
        }
        
        // Check titles for ensemble/group patterns
        if (titles.some(title => title.includes('Group') || title.includes('Quartet'))) {
            return; // Skip this entry
        }
        
        // Only add if we have a reasonable name (at least first + last)
        if (name.split(' ').length >= 2) {
            const emailConfidence = calculateEmailConfidence(name, email);
            const emailSource = email ? (emailConfidence > 0.7 ? 'name-matched' : 'section-matched') : 'none';
            
            const uniqueId = `${name}-${email}-${profileLink}`;
            if (!seenTabular.has(uniqueId)) {
                seenTabular.add(uniqueId);
                tabularResults.push({
                    name: name,
                    titles: titles,
                    profileLink: profileLink,
                    email: email,
                    emailConfidence: emailConfidence,
                    emailSource: emailSource,
                    phone: phone,
                    bio: '',
                    socials: {
                        youtube: '',
                        facebook: '',
                        instagram: '',
                        reddit: '',
                        linkedin: '',
                        tiktok: ''
                    },
                    university: getUniversityName(request.loadedUrl),
                    department: getDepartmentName(request.loadedUrl, $),
                    sourceUrl: request.loadedUrl,
                    scrapedAt: new Date().toISOString()
                });
            }
        }
    });
    
    // If Method 4 found results, compare quality with existing results
    if (tabularResults.length > 0) {
        // Check quality of existing results (from Methods 1-3)
        const existingBadNames = facultyData.filter(faculty => 
            faculty.name.match(/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/) || 
            faculty.name === 'Email' || 
            faculty.name === 'Phone' ||
            faculty.name.length < 3
        );
        
        // Check quality of Method 4 results  
        const tabularBadNames = tabularResults.filter(faculty => 
            faculty.name.match(/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/) || 
            faculty.name === 'Email' || 
            faculty.name === 'Phone' ||
            faculty.name.length < 3
        );
        
        // Calculate profile link rates
        const existingLinkRate = facultyData.length > 0 ? facultyData.filter(f => f.profileLink).length / facultyData.length : 0;
        const tabularLinkRate = tabularResults.length > 0 ? tabularResults.filter(f => f.profileLink).length / tabularResults.length : 0;
        
        const existingBadRate = facultyData.length > 0 ? existingBadNames.length / facultyData.length : 1;
        const tabularBadRate = tabularResults.length > 0 ? tabularBadNames.length / tabularResults.length : 1;
        
        log.info(`Existing methods bad rate: ${existingBadRate}, link rate: ${existingLinkRate}`);
        log.info(`Tabular bad rate: ${tabularBadRate}, link rate: ${tabularLinkRate}`);
        log.info(`Existing found: ${facultyData.length}, Tabular found: ${tabularResults.length}`);
        
        // Use tabular results if they're better quality OR have significantly more profile links
        if (tabularBadRate < existingBadRate || (tabularLinkRate > existingLinkRate + 0.2)) {
            log.info('Using tabular results - better quality or profile links');
            
            // Clear and rebuild facultyData with tabular results
            facultyData.length = 0;
            seenFaculty.clear();
            
            tabularResults.forEach(faculty => {
                const uniqueId = `${faculty.name}-${faculty.email}-${faculty.profileLink}`;
                if (!seenFaculty.has(uniqueId)) {
                    seenFaculty.add(uniqueId);
                    facultyData.push(faculty);
                }
            });
        } else {
            log.info('Using existing results - better or equal quality');
        }
    }
}

// Data quality check: If we have results but names look like phone numbers,
// clear results and try alternative regex-based parsing
if (facultyData.length > 0) {
    const phoneNumberNames = facultyData.filter(faculty => 
        faculty.name.match(/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/) || 
        faculty.name === 'Email' || 
        faculty.name === 'Phone'
    );
    
    // If more than 50% of results have phone numbers as names, the parsing is wrong
    if (phoneNumberNames.length > facultyData.length * 0.5) {
        log.info('Detected poor data quality, trying alternative regex parsing');
        
        // Clear bad results and try alternative approach
        facultyData.length = 0;
        seenFaculty.clear();
        
        // Alternative parsing - look for actual faculty names in text content
        $('table, .directory, .faculty-list').find('tr, div, p').each(function() {
            const rowText = $(this).text().trim();
            
            // Look for lines that have a name pattern (First Last) followed by title and contact info
            const nameMatch = rowText.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]*)?)/);
            
            if (nameMatch) {
                const potentialName = nameMatch[1];
                
                // Verify this looks like a faculty name and skip ensembles
                if (potentialName.split(' ').length >= 2 && potentialName.length < 50 &&
                    !potentialName.includes('Email') && !potentialName.includes('Phone') &&
                    !potentialName.includes('Room') && !potentialName.includes('Office') &&
                    !potentialName.includes('String Quartet') &&
                    !potentialName.includes('Affiliated faculty') &&
                    !potentialName.toLowerCase().includes('ensemble')) {
                    
                    // Enhanced email search using broader matching
                    const emailMatches = rowText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                    let email = '';
                    let bestConfidence = 0;
                    
                    if (emailMatches) {
                        for (const potentialEmail of emailMatches) {
                            const confidence = calculateEmailConfidence(potentialName, potentialEmail);
                            if (confidence > bestConfidence) {
                                email = potentialEmail;
                                bestConfidence = confidence;
                            }
                        }
                    }
                    
                    // Only use email if confidence is reasonable
                    const emailConfidence = bestConfidence;
                    const finalEmail = emailConfidence > 0.3 ? email : '';
                    
                    // Extract phone from the same text
                    const phoneMatch = rowText.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
                    const phone = phoneMatch ? phoneMatch[1] : '';
                    
                    // Extract title (everything after name, before email/phone)
                    let title = rowText.replace(potentialName, '').replace(finalEmail, '').replace(phone, '');
                    title = title.replace(/\s+/g, ' ').trim();
                    
                    // Use universal profile link finder
                    const profileLink = findProfileLink(potentialName, allProfileLinks);
                    
                    const emailSource = finalEmail ? (emailConfidence > 0.7 ? 'name-matched' : 'section-matched') : 'none';
                    
                    const uniqueId = `${potentialName}-${finalEmail}`;
                    if (!seenFaculty.has(uniqueId)) {
                        seenFaculty.add(uniqueId);
                        facultyData.push({
                            name: potentialName,
                            titles: title ? [title] : [],
                            profileLink: profileLink,
                            email: finalEmail,
                            emailConfidence: emailConfidence,
                            emailSource: emailSource,
                            phone: phone,
                            bio: '',
                            socials: {
                                youtube: '',
                                facebook: '',
                                instagram: '',
                                reddit: '',
                                linkedin: '',
                                tiktok: ''
                            },
                            university: getUniversityName(request.loadedUrl),
                            department: getDepartmentName(request.loadedUrl, $),
                            sourceUrl: request.loadedUrl,
                            scrapedAt: new Date().toISOString()
                        });
                    }
                }
            }
        });
    }
}

// Final cleanup: Filter out any remaining invalid entries
const cleanedFacultyData = facultyData.filter(faculty => {
    return faculty.name && 
           faculty.name !== 'undefined' &&
           faculty.name !== 'null' &&
           !faculty.name.toLowerCase().includes('jupiter') &&
           !faculty.name.includes('String Quartet') &&
           !faculty.name.includes('Affiliated faculty') &&
           !faculty.name.toLowerCase().includes('ensemble') &&
           faculty.name.split(' ').length >= 2; // Must have at least first and last name
});

// Replace facultyData with cleaned version
facultyData.length = 0;
facultyData.push(...cleanedFacultyData);

log.info(`Found ${facultyData.length} unique faculty members`);

// Email extraction statistics
if (facultyData.length > 0) {
    const emailStats = {
        total: facultyData.length,
        withEmail: facultyData.filter(f => f.email).length,
        highConfidence: facultyData.filter(f => f.emailConfidence > 0.7).length,
        mediumConfidence: facultyData.filter(f => f.emailConfidence > 0.3 && f.emailConfidence <= 0.7).length
    };
    
    log.info(`Email extraction stats:`, emailStats);
    log.info(`Email success rate: ${((emailStats.withEmail / emailStats.total) * 100).toFixed(1)}%`);
}

// Only save data if we found faculty members (avoid saving pagination pages)
if (facultyData.length > 0) {
    // Save each faculty member as a separate result
    for (const faculty of facultyData) {
        await Dataset.pushData(faculty);
    }
    
    // Also save a summary
    await Dataset.pushData({
        url: request.loadedUrl,
        totalFaculty: facultyData.length,
        university: getUniversityName(request.loadedUrl),
        department: getDepartmentName(request.loadedUrl, $),
        scrapedAt: new Date().toISOString(),
        isSummary: true
    });
}

// Debug pagination links
$('a').each(function() {
    const href = $(this).attr('href');
    const text = $(this).text().trim();
    if (text.includes('Next') || text.includes('next') || text.includes('›') || text.includes('»') || href?.includes('page')) {
        log.info(`Found pagination link: ${text} -> ${href}`);
    }
});
        log.info('enqueueing new URLs');
        await enqueueLinks({
            // Only follow links that are clearly faculty-related AND numbered pagination
            selector: 'a[href*="/faculty/"]',
            exclude: [
                /\/faculty\/[a-z]\.php$/,     // Alphabet pagination (a.php, b.php, etc.)
                /\/faculty\/[A-Z]\.php$/,     // Uppercase alphabet pagination
                /\/faculty\/.*\.php$/,        // Individual faculty profile pages
                /\/students\//,               // Student pages  
                /\/community\//,              // Community pages
                /\/about\//,                  // About pages
                /\/mckay-music-library\//,    // Library pages
                /\/ensembles\//,              // Ensemble pages
                /\/forms\//,                  // Forms
                /\/gala\//,                   // Events
                /next-steps/,                 // Navigation
                /admissions/,                 // Admissions
                /programs-degrees/,           // Programs
                /open-positions/,             // Job listings
                /emeritus/,                   // Emeritus faculty
                /past_faculty/                // Past faculty
            ],
            // Only include pages with numbered pagination patterns
            transformRequestFunction: (request) => {
                const url = request.url.toLowerCase();
                
                // Allow main directory pages
                if (url.endsWith('/faculty/') || url.includes('faculty/index')) {
                    return request;
                }
                
                // Allow numbered pagination (page=2, p=2, page2, etc.)
                if (url.match(/page[=_-]?\d+|p[=_-]?\d+|\d+\.php$|\/\d+\/?$/)) {
                    return request;
                }
                
                // Allow "next" pagination
                if (url.includes('next') && !url.includes('next-steps')) {
                    return request;
                }
                
                // Block everything else
                return false;
            }
        });

        // Extract title from the page.
        const title = $('title').text();
        log.info(`${title}`, { url: request.loadedUrl });

        // Save url and title to Dataset - a table-like storage.
        await Dataset.pushData({ url: request.loadedUrl, title });
    },
});

await crawler.run(startUrls);

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit()
await Actor.exit();
