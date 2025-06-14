const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const functions = require('./functions');
const cron = require('node-cron');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize group members JSON structure - simplified to just phone numbers
const groupMembersPath = path.join(dataDir, 'group_members.json');
if (!fs.existsSync(groupMembersPath)) {
  fs.writeFileSync(groupMembersPath, JSON.stringify([], null, 2));
}

// Add this near other file paths
const botChatsPath = path.join(dataDir, 'bot_chats.json');
if (!fs.existsSync(botChatsPath)) {
  fs.writeFileSync(botChatsPath, JSON.stringify({}, null, 2));
}

const userSessions = new Map();
// FIX: Add message processing tracking to prevent duplicates
const messageProcessingMap = new Map();
const userCooldownMap = new Map();
// Admin phone numbers - Add authorized admin numbers here
const ADMIN_PHONE_NUMBERS = [
  "972549232327", // Replace with actual admin phone numbers
  "972501234567", // Add more admin numbers as needed
  "972584828855"
];

// Load course links from JSON file
let courseLinks = {};
try {
  const data = fs.readFileSync(path.join(__dirname, "course_links.json"), "utf8");
  courseLinks = JSON.parse(data);
} catch (error) {
  console.error("Error loading course_links.json:", error);
}

// Load menus from JSON file
let menus = {};
try {
  const data = fs.readFileSync(path.join(__dirname, "menus.json"), "utf8");
  menus = JSON.parse(data);
} catch (error) {
  console.error("Error loading menus.json:", error);
  menus = {
    main: {
      message: "שגיאה בטעינת התפריטים. אנא נסו שוב מאוחר יותר.",
      options: {}
    }
  };
}

// Load teachers from JSON file
let teachers = {};
try {
  const data = fs.readFileSync(path.join(__dirname, "teachers.json"), "utf8");
  teachers = JSON.parse(data);
} catch (error) {
  console.error("Error loading teachers.json:", error);
}

// Load group members from JSON file
let groupMembers = [];
try {
  const data = fs.readFileSync(groupMembersPath, "utf8");
  groupMembers = JSON.parse(data);
} catch (error) {
  console.error("Error loading group_members.json:", error);
  groupMembers = [];
}

// === index.js (UPDATED) ===
async function processAdminCommand(command, userId) {
    if (!functions.isAdmin(userId, ADMIN_PHONE_NUMBERS)) {
        return "❌ אין לך הרשאות מנהל לביצוע פעולה זו.";
    }

    const parts = command.trim().split(/\s+/);
    const baseCommand = parts[0].toLowerCase();
    
    switch (baseCommand) {
        case '/admin_help1':
            return `🔧 *פקודות מנהל מלאות + דוגמאות שימוש*

        ━━━━━━━━━━━━━━
📋 *ניהול תפריטים*
/admin_add_menu [שם_תפריט] [הודעה]  
/admin_add_menu info_menu "ברוכים הבאים למידע כללי"

/admin_update_menu [שם_תפריט] [הודעה_חדשה]  
/admin_update_menu info_menu "עדכון: מידע חדש!"

/admin_delete_menu [שם_תפריט]  
/admin_delete_menu info_menu

/admin_list_menus  

━━━━━━━━━━━━━━
🔢 *אפשרויות בתפריט הראשי*
/admin_add_menu_option [מס׳] [טקסט] [תגובה|nextMenu:תפריט]  

/admin_add_menu_option 3 "קישורים חשובים" nextMenu:links_menu
/admin_add_menu_option 4 "שעות פעילות" "אנחנו זמינים בימים א-ה 09:00-17:00"

/admin_update_menu_option [מס׳] [טקסט_חדש] [תגובה_חדשה|nextMenu:תפריט]  
/admin_update_menu_option 3 "קישורים מעודכנים" nextMenu:links_menu

/admin_remove_menu_option [מס׳]  
/admin_remove_menu_option 3

━━━━━━━━━━━━━━
🔢 *אפשרויות בתפריטים אחרים*
/admin_add_menu_option_to_menu [שם] [מס׳] [טקסט] [תגובה|nextMenu:תפריט]

התגובה היא מה שישלח לאדם ברגע שהוא יבחר באפשרות הזאת
/admin_add_menu_option_to_menu links_menu 1 "אתר האוניברסיטה" https://openu.ac.il

/admin_update_menu_option_in_menu [שם] [מס׳] [טקסט_חדש] [תגובה_חדשה|nextMenu:תפריט]  
/admin_update_menu_option_in_menu links_menu 1 "אתר האו״פ" https://openu.ac.il

/admin_remove_menu_option_from_menu [שם] [מס׳]  
/admin_remove_menu_option_from_menu links_menu 1

/admin_list_menu_options [שם]  
/admin_list_menu_options links_menu

/admin_add_faq
[שאלה]
[תשובה]

/admin_add_faq
איך להירשם לקורס?
כדי להירשם לקורס צריך לעבור לאתר האוניברסיטה ולבחור בקורס המבוקש...

━━━━━━━━━━━━━━
📚 *קישורי קורסים*
/admin_add_course_link [סמסטר] [מספר_קורס] [קישור]  
/admin_add_course_link 2025A 101 https://example.com/101A

/admin_update_course_link [סמסטר] [מספר_קורס] [קישור_חדש]  
/admin_update_course_link 2025A 101 https://example.com/101A-v2

/admin_remove_course_link [סמסטר] [מספר_קורס]  
/admin_remove_course_link 2025A 101

/admin_list_course_links [סמסטר]  
/admin_list_course_links 2025A

━━━━━━━━━━━━━━
🔗 *קישורים כלליים*
/admin_add_link [מזהה] [שם] [קישור] [תיאור]  
/admin_add_link help_link "עזרה" https://help.example.com "מדריך למשתמש"

/admin_update_link [מזהה] [שם_חדש] [קישור_חדש] [תיאור_חדש]  
/admin_update_link help_link "עזרה מעודכנת" https://help.example.com/v2 "מדריך חדש"

/admin_remove_link [מזהה]  
/admin_remove_link help_link

/admin_list_links  

━━━━━━━━━━━━━━
👥 *קבוצות*
/admin_add_group [id_קבוצה] [שם] [תיאור]  
/admin_add_group 120@g.us "קבוצת סמסטר A" "דיונים על סמסטר A"

/admin_update_group [id_קבוצה] [שם_חדש] [תיאור_חדש]  
/admin_update_group 120@g.us "קבוצת סמסטר A (חדשה)" "תיאור מעודכן"

/admin_remove_group [id_קבוצה]  
/admin_remove_group 120@g.us

/admin_list_groups  

━━━━━━━━━━━━━━
👨🏫 *מורים*
/admin_add_teacher 
[שם]
[קורסים]
[מחיר]
[טלפון]
[תיאור]
[קהלי יעד]  


/admin_update_teacher [שם_קיים] [נתונים_חדשים]  
/admin_update_teacher "דוד לוי" "דוד לוי|103,104|220 ש\"ח לשעה|050-1234567|מורה מעודכן|סטודנטים"

/admin_remove_teacher [שם]  
/admin_remove_teacher "דוד לוי"

/admin_list_teachers  

━━━━━━━━━━━━━━
📚 *מקצועות תיכון*
/admin_add_hs_subject [מספר|שם]  
/admin_add_hs_subject 5|מתמטיקה

/admin_remove_hs_subject [מספר]  
/admin_remove_hs_subject 5

/admin_list_hs_subjects  


━━━━━━━━━━━━━━
🛡️ *רשימה שחורה*
/admin_blacklist_add [userId]  
/admin_blacklist_add 972501234567

/admin_blacklist_remove [userId]  
/admin_blacklist_remove 972501234567

/admin_blacklist_list  

/admin_resolve_lid [@lid]  
/admin_resolve_lid 12345@lid

━━━━━━━━━━━━━━
👥 *חברות בקבוצות*
/admin_scan_groups  

/admin_approve_requests [id_קבוצה]  
/admin_approve_requests 120@g.us   (ללא id – יאשר לכל הקבוצות)

━━━━━━━━━━━━━━
📢 *שידור*
/admin_broadcast [הודעה]  
/admin_broadcast "שלום לכולם – עדכון חשוב!"

━━━━━━━━━━━━━━
🔄 *כלים*
/admin_reload  

/admin_status  

*האפשרויות להשכלת מורים:*
1. סטודנטים
2. תלמידי תיכון 

━━━━━━━━━━━━━━
*סיום – לכל שאלה נוספת השתמש ב-/admin_help*`;
        case '/admin_help2':
          return `🔧 *פקודות מנהל מלאות + דוגמאות שימוש*

━━━━━━━━━━━━━━
📋 *ניהול תפריטים*

/admin_list_menus  

━━━━━━━━━━━━━━
🔢 *אפשרויות בתפריטים אחרים*
/admin_add_menu_option_to_menu [שם] [מס׳] [טקסט] [תגובה|nextMenu:תפריט]

התגובה היא מה שישלח לאדם ברגע שהוא יבחר באפשרות הזאת

*אפשרות שמחזירה תגובה(לדוגמה קישור):*

/admin_add_menu_option_to_menu additional_links 6 "Discord של הקהילה" https://discord.gg/studnet

*מה זה עושה:*

מוסיף בתפריט additional_links אפשרות מספר 6 עם הטקסט “Discord של הקהילה”.

*אפשרות שמעבירה לתפריט אחר:*

/admin_add_menu_option_to_menu teachers_menu 3 "חזור לתפריט הראשי" nextMenu:main

*מה זה עושה:*

מוסיף בתפריט teachers_menu אפשרות מספר 3 עם הטקסט “חזור לתפריט הראשי”.
בחירה באפשרות זו תנווט אוטומטית לתפריט main.

/admin_add_menu_option_to_menu links_menu 1 "אתר האוניברסיטה" https://openu.ac.il

/admin_update_menu_option_in_menu [שם] [מס׳] [טקסט_חדש] [תגובה_חדשה|nextMenu:תפריט]  

/admin_update_menu_option_in_menu links_menu 1 "אתר האו״פ" https://openu.ac.il

/admin_remove_menu_option_from_menu [שם] [מס׳]  

/admin_remove_menu_option_from_menu links_menu 1

/admin_list_menu_options [שם]  

/admin_list_menu_options links_menu

/admin_add_faq
[שאלה]
[תשובה]

/admin_add_faq
איך להירשם לקורס?
כדי להירשם לקורס צריך לעבור לאתר האוניברסיטה ולבחור בקורס המבוקש...

━━━━━━━━━━━━━━
📚 *קישורי קורסים*

/admin_add_course_link [סמסטר] [מספר_קורס] [קישור]  

/admin_add_course_link 2025A 101 https://example.com/101A

/admin_update_course_link [סמסטר] [מספר_קורס] [קישור_חדש]  

/admin_update_course_link 2025A 101 https://example.com/101A-v2

/admin_remove_course_link [סמסטר] [מספר_קורס]  

/admin_remove_course_link 2025A 101

/admin_list_course_links [סמסטר]  

/admin_list_course_links 2025A

━━━━━━━━━━━━━━
👨🏫 *מורים*

/admin_add_teacher 
[שם]
[קורסים]
[מחיר]
[טלפון]
[תיאור]
[קהלי יעד]  


/admin_update_teacher [שם_קיים] [נתונים_חדשים]  

/admin_update_teacher "דוד לוי" "דוד לוי|103,104|220 ש"ח לשעה|050-1234567|מורה מעודכן|סטודנטים"

/admin_remove_teacher [שם] 
 
/admin_remove_teacher "דוד לוי"

/admin_list_teachers  

━━━━━━━━━━━━━━
📚 *מקצועות תיכון*

/admin_add_hs_subject [מספר|שם]  

/admin_add_hs_subject 5|מתמטיקה

/admin_remove_hs_subject [מספר]  

/admin_remove_hs_subject 5

/admin_list_hs_subjects  

━━━━━━━━━━━━━━
🛡️ *רשימה שחורה*

/admin_blacklist_add [userId]
  
/admin_blacklist_add 972501234567

/admin_blacklist_remove [userId]  

/admin_blacklist_remove 972501234567

/admin_blacklist_list  

/admin_resolve_lid [@lid]  

/admin_resolve_lid 12345@lid

━━━━━━━━━━━━━━
👥 *חברות בקבוצות*

/admin_scan_groups  

/admin_approve_requests [id_קבוצה]  

/admin_approve_requests 120@g.us   (ללא id – יאשר לכל הקבוצות)

━━━━━━━━━━━━━━
📢 *שידור*

/admin_broadcast [הודעה]  

/admin_broadcast "שלום לכולם – עדכון חשוב!"

━━━━━━━━━━━━━━
🔄 *כלים*
/admin_reload  

/admin_status  

*האפשרויות להשכלת מורים:*
1. סטודנטים
2. תלמידי תיכון 

━━━━━━━━━━━━━━
`
      
        // Menu CRUD operations
        case '/admin_add_menu':
            return functions.addMenu(parts.slice(1), menus);
        case '/admin_update_menu':
            return functions.updateMenu(parts.slice(1), menus);
        case '/admin_delete_menu':
            return functions.deleteMenu(parts[1], menus);
        case '/admin_list_menus':
            return functions.listMenus(menus);
        case '/admin_add_menu_navigation':
            const [optionNum, optionText, targetMenu] = parts.slice(1);
            if (!menus.main.options) menus.main.options = {};
            menus.main.options[optionNum] = {
                text: optionText,
                nextMenu: targetMenu
            };
            updateMainMenuMessage(menus);
            return functions.saveJSONFile("menus.json", menus) ? 
                `✅ Navigation option ${optionNum} added successfully` : 
                "❌ Error saving navigation option";
        // Menu Options CRUD operations  
        case '/admin_add_menu_option':
            return functions.addMenuOption(parts.slice(1), menus);
        case '/admin_update_menu_option':
            return functions.updateMenuOption(parts.slice(1), menus);
        case '/admin_remove_menu_option':
            return functions.removeMenuOption(parts[1], menus);
        case '/admin_list_menu_options':
            return functions.listMenuOptions(parts[1], menus);
        /*──────────  **NEW**  PER-MENU OPTION CRUD COMMANDS  ────────────────*/
        case '/admin_add_menu_option_to_menu': {
              if (parts.length < 5) {
                  return "❌ פורמט שגוי.\nשימוש: /admin_add_menu_option_to_menu [שם] [מס׳] [טקסט] [תגובה/nextMenu:תפריט]";
              }
              const [menuName, optionNumber, ...rest] = parts.slice(1);
              const text  = rest.shift();
              const value = rest.join(' ').trim();
              return functions.addMenuOptionToMenu(menuName, optionNumber, text, value, menus);
          }

        case '/admin_update_menu_option_in_menu': {
              if (parts.length < 5) {
                  return "❌ פורמט שגוי.\nשימוש: /admin_update_menu_option_in_menu [שם] [מס׳] [טקסט_חדש] [תגובה_חדשה/nextMenu:תפריט]";
              }
              const [menuName, optionNumber, ...rest] = parts.slice(1);
              const newText  = rest.shift();
              const newValue = rest.join(' ').trim();
              return functions.updateMenuOptionInMenu(menuName, optionNumber, newText, newValue, menus);
          }
        case '/admin_add_faq': {
            const commandText = command.slice(command.indexOf('\n') + 1);
            if (!commandText || commandText.trim() === '') {
                return "❌ פורמט שגוי.\n\nשימוש:\n/admin_add_faq\n[שאלה]\n[תשובה]\n\nדוגמה:\n/admin_add_faq\nאיך להירשם לקורס?\nכדי להירשם לקורס צריך לעבור לאתר האוניברסיטה...";
            }
            
            // NEW: Split without removing empty lines to preserve paragraphs
            const lines = commandText.split('\n');
            
            // NEW: Only trim and filter for the question (first non-empty line)
            const nonEmptyLines = lines.filter(line => line.trim() !== '');
            if (nonEmptyLines.length < 2) {
                return "❌ חייבות להיות לפחות 2 שורות: שאלה ותשובה.";
            }
            
            // Get the first non-empty line as the question
            const questionText = nonEmptyLines[0].trim();
            
            // Find where the question ends in the original lines array
            const questionIndex = lines.findIndex(line => line.trim() === questionText);
            
            // Get everything after the question, preserving empty lines for paragraphs
            const answerLines = lines.slice(questionIndex + 1);
            const answerText = answerLines.join('\n');
            
            return functions.addFAQOption(questionText, answerText, menus);
        }
        case '/admin_remove_menu_option_from_menu': {
            if (parts.length < 3) {
                return "❌ פורמט שגוי.\nשימוש: /admin_remove_menu_option_from_menu [שם] [מס׳]";
            }
        return functions.removeMenuOptionFromMenu(parts[1], parts[2], menus);
        }

        // Course Links CRUD operations
        case '/admin_add_course_link':
            return functions.addCourseLink(parts[1], parts[2], parts[3], courseLinks);
        case '/admin_update_course_link':
            return functions.updateCourseLink(parts[1], parts[2], parts[3], courseLinks);
        case '/admin_remove_course_link':
            return functions.removeCourseLink(parts[1], parts[2], courseLinks);
        case '/admin_list_course_links':
            return functions.listCourseLinks(parts[1], courseLinks);

        // General Links CRUD operations
        case '/admin_add_link':
            return await functions.addGeneralLink(parts.slice(1));
        case '/admin_update_link':
            return await functions.updateGeneralLink(parts.slice(1));
        case '/admin_remove_link':
            return await functions.removeGeneralLink(parts[1]);
        case '/admin_list_links':
            return await functions.listGeneralLinks();

        // Groups CRUD operations
        case '/admin_add_group':
            return await functions.addGroup(parts.slice(1));
        case '/admin_update_group':
            return await functions.updateGroup(parts.slice(1));
        case '/admin_remove_group':
            return await functions.removeGroup(parts[1]);
        case '/admin_list_groups':
            return await functions.listGroups();

        // Teacher CRUD operations
        case '/admin_add_teacher': {
          const teacherData = command.slice(command.indexOf('\n') + 1); // may be empty
          return functions.addTeacher(teacherData, teachers);
        }
        case '/admin_update_teacher':
            const updateData = command.slice(parts[0].length + parts[1].length + 1).trimStart();
            return functions.updateTeacher(parts[1], updateData, teachers);
        case '/admin_remove_teacher':
            return functions.removeTeacher(parts.slice(1).join(' '), teachers);
        case '/admin_list_teachers':
            return functions.listTeachers(teachers);

        // Blacklist operations
        case '/admin_blacklist_add':
            const userToAdd = parts.slice(1).join(' ').trim();
            if (!userToAdd) {
                return "❌ Please provide user ID. Usage: /admin_blacklist_add [userId]";
            }
            return await functions.addToBlacklist(userToAdd, client);
        case '/admin_blacklist_remove':
            const userToRemove = parts.slice(1).join(' ').trim();
            if (!userToRemove) {
                return "❌ Please provide user ID. Usage: /admin_blacklist_remove [userId]";
            }
            return await functions.removeFromBlacklist(userToRemove);
        case '/admin_blacklist_list':
            return await functions.listBlacklist();
        case '/admin_resolve_lid':
            const lidToResolve = parts[1];
            if (!lidToResolve) {
                return "❌ Please provide @lid ID. Usage: /admin_resolve_lid [lidId]";
            }
            return await functions.resolveLidToPhone(lidToResolve, client);

        // High school subjects operations
        case '/admin_add_hs_subject':
            return functions.addHighSchoolSubject(parts.slice(1).join(' '), menus);
        case '/admin_remove_hs_subject':
            return functions.removeHighSchoolSubject(parts[1], menus);
        case '/admin_list_hs_subjects':
            return functions.listHighSchoolSubjects(menus);

        // Group operations
        case '/admin_scan_groups':
            return await functions.scanGroupMembers(client, groupMembersPath, groupMembers);
        case '/admin_approve_requests':
            const groupId = parts[1] || null;
            return await functions.approveGroupRequests(groupId, {}, client);

        // Broadcast operations
        case '/admin_broadcast':
            const broadcastText = parts.slice(1).join(' ');
            if (!broadcastText || broadcastText.trim() === '') {
                return "❌ אנא הזן הודעה לשידור. שימוש: /admin_broadcast [הודעה]";
            }
            return await functions.broadcastMessage(broadcastText.trim(), botChatsPath, client);

        // System operations
        case '/admin_reload':
            const reloadResult = await functions.reloadData(menus, teachers, courseLinks, groupMembersPath, groupMembers, async () => {
                return await functions.scanGroupMembers(client, groupMembersPath, groupMembers);
            });
            return reloadResult ? "✅ נתונים נטענו מחדש בהצלחה (כולל סריקת קבוצות)." : "❌ שגיאה בטעינת נתונים.";
        case '/admin_status':
            const phoneNumbers = fs.existsSync(groupMembersPath) ?
                JSON.parse(fs.readFileSync(groupMembersPath, 'utf8')) : [];
            const botChatsData = fs.existsSync(botChatsPath) ?
                JSON.parse(fs.readFileSync(botChatsPath, 'utf8')) : {};

            const now = new Date();
            const currentDate = new Date();
            let pastMonthCount = 0;
            let pastWeekCount = 0;
            let inGroupCount = 0;
            let notInGroupCount = 0;

            Object.entries(botChatsData).forEach(([phone, timestamp]) => {
                const lastInteraction = new Date(timestamp);
                if (lastInteraction > new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, currentDate.getDate())) {
                    pastMonthCount++;
                }
                if (lastInteraction > new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000)) {
                    pastWeekCount++;
                }
                const inGroup = phoneNumbers.includes(`${phone}@c.us`) || phoneNumbers.includes(phone);
                if (inGroup) {
                    inGroupCount++;
                } else {
                    notInGroupCount++;
                }
            });

            return `📊 *סטטוס המערכת:*
👥 מורים רשומים: ${teachers.teachers ? teachers.teachers.length : 0}
📚 קישורי קורסים: ${Object.keys(courseLinks).length} סמסטרים
🎯 אפשרויות תפריט ראשי: ${Object.keys(menus.main.options).length}
📱 חברי קבוצות: ${phoneNumbers.length}
📋 תפריטים במערכת: ${Object.keys(menus).length}
📈 *סטטיסטיקות משתמשים:*
🗓️ דיברו עם הבוט בחודש האחרון: ${pastMonthCount}
📅 דיברו עם הבוט בשבוע האחרון: ${pastWeekCount}
👥 משתמשים בקבוצות: ${inGroupCount}
🚶 משתמשים לא בקבוצות: ${notInGroupCount}
📱 סך משתמשים ייחודיים: ${Object.keys(botChatsData).length}
⚡ מערכת פעילה ותקינה`;

        default:
            return "❌ פקודה לא מוכרת. השתמש ב-/admin_help לרשימת פקודות זמינות.";
    }
}

// UPDATED: Initialize the WhatsApp client with improved configuration
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-extensions",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding"
    ],
  },
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1023840439-alpha.html'
  }
});

// Event fired when a QR code is generated
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("QR RECEIVED", qr);
});

// Event fired when the client has authenticated successfully
client.on("authenticated", () => {
  console.log("AUTHENTICATED");
});

// Event fired when authentication fails
client.on("auth_failure", (msg) => {
  console.error("AUTHENTICATION FAILURE", msg);
});

// Event fired when the client is ready
client.on("ready", () => {
  console.log("Client is ready!");
});

// Initialize the client
client.initialize();

// FIX: Enhanced message handler with proper deduplication and error handling
client.on("message", async (message) => {
  try {
    const chat = await message.getChat();
    const isGroup = chat.isGroup;
    const userId = message.from;
    const messageText = message.body.trim();
    const messageId = message.id.id;
    console.log(chat.id);

    // Enhanced filtering: Skip groups, status, own messages
    if (message.from.includes("@g.us") ||
        message.from === "status@broadcast" ||
        message.fromMe) {
      return;
    }

    // FIX: Add message deduplication check
    if (functions.isMessageBeingProcessed(userId, messageId, messageText, messageProcessingMap)) {
      return; // Skip duplicate messages
    }

    // FIX: Add user cooldown check
    if (functions.isUserOnCooldown(userId, userCooldownMap)) {
      return; // Skip rapid successive messages
    }

    // Enhanced logging for debugging
    console.log(`[MESSAGE] From: ${userId} | Text: "${messageText}" | ID: ${messageId}`);
    
    // Track user interaction
    functions.updateUserInteraction(userId, botChatsPath);
    
    // Check for admin commands first
    if (messageText.startsWith('/admin_')) {
      const response = await processAdminCommand(messageText, userId);
      await message.reply(response);
      return;
    }

    // FIX: Enhanced session management with atomic operations
    let session = userSessions.get(userId);
    let isNewUser = false;
    
    if (!session) {
      // FIX: Create session with comprehensive state management and atomic assignment
      session = {
        currentMenu: "main",
        menuHistory: [],
        selectedSemester: null,
        state: "menu", // Possible states: "menu", "viewing_response", "waiting_for_course", "viewing_teachers"
        createdAt: Date.now(),
        isProcessingFirstMessage: true // FIX: Flag to prevent duplicate processing
      };
      userSessions.set(userId, session);
      isNewUser = true;
      console.log(`[NEW_USER] Created session for ${userId}`);
    }

    let response = "";
    const currentMenuData = menus[session.currentMenu];

    // FIX: Enhanced new user handling with additional safeguards
    if (isNewUser || session.isProcessingFirstMessage) {
      console.log(`[NEW_USER_FLOW] Processing first message for ${userId}`);
      // FIX: Clear the first message flag immediately to prevent race conditions
      if (session.isProcessingFirstMessage) {
        session.isProcessingFirstMessage = false;
        userSessions.set(userId, session);
      }
      
      response = functions.createMenu(userId, userSessions, menus);
      console.log(`[NEW_USER_REPLY] Sending main menu to ${userId}`);
      await message.reply(response);
      // FIX: Add a small delay to ensure message is processed
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log(`[NEW_USER_COMPLETE] Finished processing first message for ${userId}`);
      return; // CRITICAL: Prevent any further processing
    }

    // Handle navigation commands
    if (messageText === "0") {
      // Quick return to main menu - reset all state
      console.log(`[NAVIGATION] User ${userId} returning to main menu`);
      session.currentMenu = "main";
      session.menuHistory = [];
      session.selectedSemester = null;
      session.state = "menu";
      response = functions.createMenu(userId, userSessions, menus);
    }
    else if (messageText === "חזור") {
      // Enhanced "חזור" logic that considers current state
      console.log(`[NAVIGATION] User ${userId} going back from state: ${session.state}`);
      if (session.state === "viewing_response") {
        // If user is viewing a response, go back to the menu that generated it
        session.state = "menu";
        response = functions.createMenu(userId, userSessions, menus);
      } else if (session.state === "viewing_teachers") {
        // If user is viewing teacher results, go back to teacher input menu
        session.state = "menu";
        response = functions.createMenu(userId, userSessions, menus);
      } else if (session.menuHistory.length > 0) {
        // Normal navigation: go back to previous menu
        session.currentMenu = session.menuHistory.pop();
        // Only reset selectedSemester if going back to main or semester_selection
        if (session.currentMenu === "main" || session.currentMenu === "semester_selection") {
          session.selectedSemester = null;
        }
        
        session.state = "menu";
        response = functions.createMenu(userId, userSessions, menus);
      } else {
        // Already at main menu
        session.currentMenu = "main";
        session.state = "menu";
        response = "אתה כבר בתפריט הראשי.\n\n" + functions.createMenu(userId, userSessions, menus);
      }
    }
    // Handle different states with proper logic
    else if (session.state === "viewing_response") {
      // User is viewing a response - only allow navigation commands
      console.log(`[STATE] User ${userId} in viewing_response state, invalid input: ${messageText}`);
      response = "💡 להמשיך, אנא השתמש:\n• 'חזור' - חזרה לתפריט הקודם\n• '0' - חזרה לתפריט הראשי";
    }
    else if (session.state === "viewing_teachers") {
      // User is viewing teacher results - only allow navigation commands
      console.log(`[STATE] User ${userId} in viewing_teachers state, invalid input: ${messageText}`);
      response = "💡 להמשיך, אנא השתמש:\n• 'חזור' - חזרה לתפריט הקודם\n• '0' - חזרה לתפריט הראשי";
    }
    else if (session.currentMenu === "course_number_input") {
      const semester = session.selectedSemester;
      const courseNumber = messageText;
      console.log(`[COURSE_LOOKUP] User ${userId} looking for course ${courseNumber} in semester ${semester}`);
      if (semester && courseLinks[semester] && courseLinks[semester][courseNumber]) {
        response = `הקישור לקורס ${courseNumber} בסמסטר ${semester} הוא: ${courseLinks[semester][courseNumber]}\n\n'חזור' - חזרה לתפריט הקודם\n'0' - חזרה מהירה לתפריט הראשי`;
        session.state = "viewing_response";
      } else {
        response = "❌ מספר קורס לא חוקי או לא נמצא. אנא נסה שוב.\n\n" + menus.course_number_input.message;
      }
    }
    else if (session.currentMenu === "teacher_course_input") {
        const courseNumber = messageText;
        const teachingLevel = session.teachingLevel || "סטודנטים";
        
        console.log(`[TEACHER_LOOKUP] User ${userId} looking for teachers for course ${courseNumber}, level: ${teachingLevel}`);
        
        if (teachers.teachers) {
            const availableTeachers = teachers.teachers.filter(teacher => 
                teacher.teaching.includes(courseNumber) && 
                teacher.teachingLevel === teachingLevel
            );
            
            if (availableTeachers.length > 0) {
                response = `👨🏫 *מורים פרטיים לקורס ${courseNumber}*\n\n`;
                availableTeachers.forEach((teacher, index) => {
                    response += `${index + 1}. *${teacher.name}*\n`;
                    response += ` 📞 טלפון: ${teacher.phone}\n`;
                    response += ` 💰 מחיר: ${teacher.price}\n`;
                    response += ` 📚 רלוונטי גם לקורסים: ${teacher.teaching.join(", ")}\n`;
                    response += ` 🎯 רמה: ${teacher.teachingLevel}\n`;
                    if (teacher.summary) {
                        response += ` 👤 על המורה: ${teacher.summary}\n`;
                    }
                    response += `\n`;
                    response+=`לשיחה מהירה דרך WhatsApp לחץ/י על הקישור הבא:\n`
                    response += `https://wa.me/${teacher.phone}?text=היי,%20אשמח%20לקבל%20פרטים%20נוספים%20ובמידה%20ומתאים%20לקבוע%20שיעור\n\n`;
                    response += `\n`;
                });
                response += "\n\n'חזור' - חזרה לתפריט הקודם\n'0' - חזרה מהירה לתפריט הראשי";
                session.state = "viewing_teachers";
            } else {
                response = `❌ לא נמצאו מורים פרטיים לקורס ${courseNumber} ברמת ${teachingLevel}.\n\nנסו מספר קורס אחר או פנו לתמיכה טכנית.\n\n` + menus.teacher_course_input.message + "\n\n• 'חזור' - חזרה לתפריט הקודם\n• '0' - חזרה לתפריט הראשי";
            }
        } else {
            response = "❌ שגיאה בטעינת נתוני המורים. אנא נסו שוב מאוחר יותר.\n\n" + menus.teacher_course_input.message + "\n\n• 'חזור' - חזרה לתפריט הקודם\n• '0' - חזרה לתפריט הראשי";
          
        }
    }

    // Add new handler for high school teachers
    else if (session.currentMenu === "teacher_highschool_input") {
        const currentMenuData = menus[session.currentMenu];
        
        if (currentMenuData && currentMenuData.options[messageText]) {
            const chosenOption = currentMenuData.options[messageText];
            const subject = chosenOption.subject;
            
            console.log(`[TEACHER_LOOKUP] User ${userId} looking for high school teachers for subject: ${subject}`);
            
            const availableTeachers = teachers.teachers.filter(teacher => 
                teacher.teaching.includes(subject) && 
                teacher.teachingLevel === "תלמידי תיכון"
            );
            
            if (availableTeachers.length > 0) {
                response = `👨🏫 *מורים פרטיים ל${subject}*\n\n`;
                // Option A – link for every teacher (matches the pattern you already use for course teachers)
                availableTeachers.forEach((teacher, index) => {
                  response += `${index + 1}. *${teacher.name}*\n`;
                  response += ` 📞 ${teacher.phone}\n`;
                  response += ` 💰 ${teacher.price}\n`;
                  if (teacher.summary) response += ` 📝 ${teacher.summary}\n`;
                  response+= `\n`
                  response += `לשיחה מהירה דרך WhatsApp לחץ/י על הקישור הבא:\n`;
                  response += `https://wa.me/${teacher.phone}?text=היי,%20אשמח%20לקבל%20פרטים%20נוספים%20ובמידה%20ומתאים%20לקבוע%20שיעור\n\n`;
                });
                response += `\n`;
                response +="'חזור' - חזרה לתפריט הקודם\n'0' - חזרה מהירה לתפריט הראשי";
              } else {
                response = `❌ לא נמצאו מורים פרטיים ל${subject}.\nנסו מקצוע אחר או פנו לתמיכה טכנית.`;
            }
        } else {
            response = "❌ בחירה לא חוקית. אנא בחרו מספר מהרשימה.\n" + currentMenuData.message + "\n\n• 'חזור' - חזרה לתפריט הקודם\n• '0' - חזרה לתפריט הראשי";
        }
    }

    // Update session handling for teachingLevel in menu navigation
    else if (currentMenuData && currentMenuData.options[messageText]) {
        const chosenOption = currentMenuData.options[messageText];
        console.log(`[MENU_SELECTION] User ${userId} selected option ${messageText} in menu ${session.currentMenu}`);
        
        // Check if user is trying to access restricted options (6 or 5) and is not in groups
        if ((messageText === "6" || messageText === "5") && session.currentMenu === "main") {
            if (!functions.isUserInGroup(userId, groupMembersPath)) {
                console.log(`[ACCESS_DENIED] User ${userId} not in group, denying access to option ${messageText}`);
                response = "❌ **גישה מוגבלת**\n\nתכונה זו זמינה רק לחברי הקבוצות שלנו.\n\nכדי לקבל גישה:\n1️⃣ כנסו לקבוצות דרך התפריט הראשי ";
                await message.reply(response);
                return;
            }
        }
        
        if (chosenOption.nextMenu) {
            session.menuHistory.push(session.currentMenu);
            session.currentMenu = chosenOption.nextMenu;
            session.state = "menu";
            
            // Store semester selection
            if (chosenOption.semester) {
                session.selectedSemester = chosenOption.semester;
            }
            
            // Store teaching level selection
            if (chosenOption.teachingLevel) {
                session.teachingLevel = chosenOption.teachingLevel;
            }
            
            response = menus[session.currentMenu].message;
        } else if (chosenOption.response) {
            session.state = "viewing_response";
            response = chosenOption.response + "\n\n'חזור' - חזרה לתפריט הקודם\n'0' - חזרה מהירה לתפריט הראשי";
        }
    }
    else {
      // FIX: Enhanced error handling with better context awareness
      console.log(`[INVALID_INPUT] User ${userId} sent invalid input: "${messageText}" in state: ${session.state}, menu: ${session.currentMenu}`);
      if (session.state === "menu") {
        response = "❌ בחירה לא חוקית.\n\n 💡 להמשיך, אנא השתמש:\n• 'חזור' - חזרה לתפריט הקודם\n• '0' - חזרה לתפריט הראשי";
      } else {
        response = "💡 להמשיך, אנא השתמש:\n• 'חזור' - חזרה לתפריט הקודם\n• '0' - חזרה לתפריט הראשי";
      }
    }

    // Update session state
    userSessions.set(userId, session);
    
    // Send response
    console.log(`[REPLY] Sending response to ${userId}: "${response.substring(0, 50)}..."`);
    await message.reply(response);
  } catch (error) {
    console.error(`[ERROR] Message handler error for user ${message.from}:`, error);
    // FIX: Graceful error handling with user feedback
    try {
      await message.reply("❌ אירעה שגיאה. אנא נסה שוב או פנה לתמיכה טכנית. \n\n 💡 להמשיך, אנא השתמש:\n• 'חזור' - חזרה לתפריט הקודם\n• '0' - חזרה לתפריט הראשי");
    } catch (replyError) {
      console.error(`[ERROR] Failed to send error message:`, replyError);
    }
  }
});
cron.schedule(
  '0 4 * * *',
  async () => {
    try {
      console.log('[CRON] 04:00 job started');

      // 👉 1st scheduled action
      await functions.scanGroupMembers(client, groupMembersPath, groupMembers);
      //    (replace with whatever you need)

      // 👉 2nd scheduled action
      //await functions.approveGroupRequests(null, {}, client);
      //    (replace with whatever you need)

      console.log('[CRON] 04:00 job completed');
    } catch (err) {
      console.error('[CRON] 04:00 job FAILED:', err);
    }
  },
  {
    scheduled: true,
    timezone: 'Asia/Jerusalem',   // guarantees “4 AM” is local Israeli time
  }
);
function saveJSONFile(filename, data) {
    const finalFile = path.join(__dirname, filename);
    const tempFile = `${finalFile}.tmp`;
    try {
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempFile, finalFile);
        return true;
    } catch (error) {
        console.error(`Error saving ${filename}:`, error);
        if (fs.existsSync(tempFile)) {
            try {
                fs.unlinkSync(tempFile);
            } catch (cleanupError) {
                console.error(`Failed to cleanup temp file ${tempFile}:`, cleanupError);
            }
        }
        return false;
    }
}
