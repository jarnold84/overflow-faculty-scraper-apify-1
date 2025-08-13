async function pageFunction(context) {
    const $ = context.$;
    
    context.log.info(`Scraping: ${context.request.url}`);
    
    // Helper function to get base URL for relative links
    function getBaseUrl(url) {
        try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.host}`;
        } catch (e) {
            return url.split('/').slice(0, 3).join('/');
        }
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
    function extractSocials($, context) {
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
    
    const facultyData = [];
    const seenFaculty = new Set();
    
    // Extract social media links once for the entire page
    const pageSocials = extractSocials($, context);
    
    // Method 1: Kansas-style (structured HTML)
    $('.views-row').each(function() {
        const $row = $(this);
        const nameElement = $row.find('a').first();
        const name = nameElement.text().trim();
        
        if (!name || name.includes('View full profile') || name.length < 3) {
            return;
        }
        
        const profileLink = nameElement.attr('href');
        const baseUrl = getBaseUrl(context.request.url);
        const fullProfileLink = profileLink && profileLink.startsWith('/') ? 
                               `${baseUrl}${profileLink}` : profileLink || '';
        
        const titles = [];
        $row.find('li').each(function() {
            const titleText = $(this).text().trim();
            if (titleText && !titleText.includes('View full profile')) {
                titles.push(titleText);
            }
        });
        
        const uniqueId = `${name}-${fullProfileLink}`;
        if (!seenFaculty.has(uniqueId)) {
            seenFaculty.add(uniqueId);
            facultyData.push({
                name: name,
                titles: titles,
                profileLink: fullProfileLink,
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
                university: getUniversityName(context.request.url),
                department: 'School of Music',
                sourceUrl: context.request.url,
                scrapedAt: new Date().toISOString()
            });
        }
    });
    
    // Method 2: Illinois-style - improved with profile links
    if (facultyData.length === 0) {
        const pageText = $('body').text();
        const lines = pageText.split('\n').map(line => line.trim()).filter(line => line && line.length > 1);
        
        // Also extract all profile links from the page
        const profileLinks = {};
        $('a').each(function() {
            const href = $(this).attr('href');
            const linkText = $(this).text().trim();
            if (href && (href.includes('/people/') || href.includes('/faculty/')) && 
                linkText && linkText.length > 2) {
                const baseUrl = getBaseUrl(context.request.url);
                profileLinks[linkText] = href.startsWith('http') ? href : `${baseUrl}${href}`;
            }
        });
        
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
                    
                    // Look for profile link for this faculty member
                    const profileLink = profileLinks[name] || '';
                    
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
                            university: getUniversityName(context.request.url),
                            department: 'School of Music',
                            sourceUrl: context.request.url,
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
        context.log.info('Trying Utah-style extraction method');
        
        // Get the base URL for relative links
        const baseUrl = getBaseUrl(context.request.url);
        
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
                
                const fullProfileLink = href.startsWith('http') ? href : `${baseUrl}${href}`;
                
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
                
                const uniqueId = `${name}-${fullProfileLink}`;
                if (!seenFaculty.has(uniqueId)) {
                    seenFaculty.add(uniqueId);
                    facultyData.push({
                        name: name,
                        titles: titles,
                        profileLink: fullProfileLink,
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
                        university: getUniversityName(context.request.url),
                        department: 'School of Music',
                        sourceUrl: context.request.url,
                        scrapedAt: new Date().toISOString()
                    });
                }
            }
        });
    }
    
    context.log.info(`Found ${facultyData.length} unique faculty members`);
    
    // Debug pagination links
    $('a').each(function() {
        const href = $(this).attr('href');
        const text = $(this).text().trim();
        if (text.includes('Next') || text.includes('next') || text.includes('›') || text.includes('»') || href?.includes('page')) {
            context.log.info(`Found pagination link: ${text} -> ${href}`);
        }
    });
    
    return {
        url: context.request.url,
        totalFaculty: facultyData.length,
        faculty: facultyData,
        scrapedAt: new Date().toISOString()
    };
}
