log.info(`Scraping: ${request.loadedUrl}`);

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
    
    // Use universal profile link finder
    const profileLink = findProfileLink(name, allProfileLinks);
    
    const titles = [];
    $row.find('li').each(function() {
        const titleText = $(this).text().trim();
        if (titleText && !titleText.includes('View full profile')) {
            titles.push(titleText);
        }
    });
    
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
            scrapedAt: new Date().toISOString()
        });
    }
});

// Method 2: Illinois-style - improved with universal profile link extraction
if (facultyData.length === 0) {
    const pageText = $('body').text();
    const lines = pageText.split('\n').map(line => line.trim()).filter(line => line && line.length > 1);
    
    for (let i = 0; i < lines.length - 1; i++) {
        const currentLine = lines[i];
        
        // Better filtering to avoid junk entries
        if (currentLine && 
            !currentLine.includes('@') &&
            currentLine !== 'Faculty' &&
            currentLine !== 'Faculty Directory' &&
            currentLine !== 'Search faculty by name, title, or position' &&
            currentLine !== 'Clear input field' &&
            currentLine.length > 2 && 
            currentLine.length < 50 &&
            !currentLine.includes('217-') &&
            !currentLine.includes('music@illinois') &&
            !currentLine.includes('Previous') &&
            !currentLine.includes('Next') &&
            !currentLine.includes('Cookie') &&
            !currentLine.includes('Settings')) {
            
            // Look ahead to find the email and collect titles in between
            let foundEmail = '';
            let titles = [];
            
            for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                const nextLine = lines[j];
                
                if (nextLine.includes('@') && nextLine.includes('.edu')) {
                    foundEmail = nextLine;
                    break;
                } else if (nextLine === 'Faculty') {
                    // Stop if we hit "Faculty" without finding email
                    break;
                } else if (nextLine && 
                          nextLine.length > 5 && 
                          !nextLine.includes('Faculty Directory') &&
                          !nextLine.includes('Search faculty')) {
                    // This line between name and email is likely a title
                    titles.push(nextLine);
                }
            }
            
            // If we found a valid email, this is a faculty member
            // Exclude generic department emails but allow all individual faculty emails
            if (foundEmail && 
                !foundEmail.includes('music@') && 
                !foundEmail.includes('info@') && 
                !foundEmail.includes('admin@') && 
                !foundEmail.includes('contact@')) {
                const name = currentLine;
                const email = foundEmail;
                
                // Use universal profile link finder
                const profileLink = findProfileLink(name, allProfileLinks);
                
                const emailConfidence = calculateEmailConfidence(name, email);
                const emailSource = emailConfidence > 0.7 ? 'name-matched' : 'proximity-fallback';
                
                const uniqueId = `${name}-${email}`;
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
                
                // Skip ahead past this faculty entry
                i = i + titles.length + 1;
            }
        }
    }
}

// Method 3: Utah-style (table/markdown layout with links)
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
            !href.includes('open-positions') && !href.includes('faculty-area')) {
            
            // Use universal profile link finder (more reliable than local extraction)
            const profileLink = findProfileLink(name, allProfileLinks);
            
            // Look for email links near this faculty member
            let email = '';
            
            // Find the faculty member's section/container
            const $facultySection = $(this).closest('p, div, tr').parent();
            
            // Look for mailto links in the same section or nearby
            $facultySection.find('a[href^="mailto:"]').each(function() {
                const emailHref = $(this).attr('href');
                if (emailHref) {
                    // Clean the email: remove mailto: and any query parameters
                    let cleanEmail = emailHref.replace('mailto:', '').split('?')[0].trim();
                    
                    // Check if email matches the faculty member's name
                    const firstName = name.split(' ')[0].toLowerCase();
                    const lastName = name.split(' ').length > 1 ? name.split(' ')[name.split(' ').length - 1].toLowerCase() : '';
                    
                    if (cleanEmail.toLowerCase().includes(firstName) || 
                        (lastName && cleanEmail.toLowerCase().includes(lastName))) {
                        // Email contains faculty member's name - likely theirs
                        email = cleanEmail;
                    } else if (!email) {
                        // Fallback: use any email in their section if no better match found
                        email = cleanEmail;
                    }
                }
            });
            
            // If no email found in section, look more broadly around the faculty link
            if (!email) {
                const $context = $(this).parent().parent();
                $context.find('a[href^="mailto:"]').first().each(function() {
                    const emailHref = $(this).attr('href');
                    if (emailHref) {
                        // Clean the email: remove mailto: and any query parameters
                        let cleanEmail = emailHref.replace('mailto:', '').split('?')[0].trim();
                        email = cleanEmail;
                    }
                });
            }
            
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
            
            const emailConfidence = calculateEmailConfidence(name, email);
            const emailSource = email ? (emailConfidence > 0.7 ? 'name-matched' : 'proximity-fallback') : 'none';
            
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

// Method 4: Tabular faculty directory (UNF style) - ALWAYS RUNS NOW
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
            name.includes('Directory') || name.includes('Faculty')) {
            return;
        }
        
        // Use universal profile link finder
        const profileLink = findProfileLink(name, allProfileLinks);
        
        // Extract email, phone, title from structured cells or nearby text
        const cells = $(this).find('td, .cell, .info');
        let email = '';
        let phone = '';
        let titles = [];
        
        // Method A: Look in table cells
        cells.each(function() {
            const cellText = $(this).text().trim();
            
            // Check for email pattern
            if (cellText.includes('@') && cellText.includes('.edu')) {
                email = cellText;
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
            
            // Extract email
            const emailMatch = rowText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch && !email) {
                email = emailMatch[0];
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
        
        // Only add if we have a reasonable name (at least first + last)
        if (name.split(' ').length >= 2) {
            const emailConfidence = calculateEmailConfidence(name, email);
            const emailSource = email ? (emailConfidence > 0.7 ? 'name-matched' : 'proximity-fallback') : 'none';
            
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
                
                // Verify this looks like a faculty name
                if (potentialName.split(' ').length >= 2 && potentialName.length < 50 &&
                    !potentialName.includes('Email') && !potentialName.includes('Phone') &&
                    !potentialName.includes('Room') && !potentialName.includes('Office')) {
                    
                    // Extract email from the same text
                    const emailMatch = rowText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
                    const email = emailMatch ? emailMatch[1] : '';
                    
                    // Extract phone from the same text
                    const phoneMatch = rowText.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
                    const phone = phoneMatch ? phoneMatch[1] : '';
                    
                    // Extract title (everything after name, before email/phone)
                    let title = rowText.replace(potentialName, '').replace(email, '').replace(phone, '');
                    title = title.replace(/\s+/g, ' ').trim();
                    
                    // Use universal profile link finder
                    const profileLink = findProfileLink(potentialName, allProfileLinks);
                    
                    const emailConfidence = calculateEmailConfidence(potentialName, email);
                    const emailSource = email ? (emailConfidence > 0.7 ? 'name-matched' : 'proximity-fallback') : 'none';
                    
                    const uniqueId = `${potentialName}-${email}`;
                    if (!seenFaculty.has(uniqueId)) {
                        seenFaculty.add(uniqueId);
                        facultyData.push({
                            name: potentialName,
                            titles: title ? [title] : [],
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
            }
        });
    }
}

log.info(`Found ${facultyData.length} unique faculty members`);

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
