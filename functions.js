// === functions.js (UPDATED) ===
const fs = require("fs");
const path = require("path");

// FIX: Enhanced message deduplication function
function isMessageBeingProcessed(userId, messageId, messageText, messageProcessingMap) {
    const messageKey = `${userId}_${messageId}_${messageText}`;
    const now = Date.now();

    if (messageProcessingMap.has(messageKey)) {
        const processingTime = messageProcessingMap.get(messageKey);
        if (now - processingTime < 2000) {
            console.log(`[DUPLICATE] Skipping duplicate message from ${userId}: ${messageText}`);
            return true;
        }
    }

    messageProcessingMap.set(messageKey, now);
    for (const [key, timestamp] of messageProcessingMap.entries()) {
        if (now - timestamp > 10000) {
            messageProcessingMap.delete(key);
        }
    }
    return false;
}

function isUserOnCooldown(userId, userCooldownMap) {
    const now = Date.now();
    const lastActivity = userCooldownMap.get(userId);
    if (lastActivity && now - lastActivity < 500) {
        console.log(`[COOLDOWN] User ${userId} on cooldown`);
        return true;
    }
    userCooldownMap.set(userId, now);
    return false;
}

function isAdmin(userId, ADMIN_PHONE_NUMBERS) {
    const phoneNumber = userId.split('@')[0];
    return ADMIN_PHONE_NUMBERS.includes(phoneNumber);
}

function saveJSONFile(filename, data) {
    const finalFile = path.join(__dirname, filename);
    const tempFile = `${finalFile}.tmp`;
    
    console.log(`[DEBUG] Attempting to save to: ${finalFile}`);
    console.log(`[DEBUG] Data to save:`, JSON.stringify(data, null, 2));
    
    try {
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[DEBUG] Temporary file written successfully: ${tempFile}`);
        
        fs.renameSync(tempFile, finalFile);
        console.log(`[DEBUG] File renamed successfully to: ${finalFile}`);
        
        // Verify the file was actually written
        const verification = fs.readFileSync(finalFile, 'utf8');
        console.log(`[DEBUG] Verification read:`, verification);
        
        return true;
    } catch (error) {
        console.error(`[ERROR] Error saving ${filename}:`, error);
        console.error(`[ERROR] Error details:`, error.message);
        console.error(`[ERROR] Stack trace:`, error.stack);
        
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

// Initialize data files
function initializeDataFiles() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const files = {
        'general_links.json': {},
        'groups.json': {}
    };

    Object.entries(files).forEach(([filename, defaultData]) => {
        const filepath = path.join(__dirname, filename);
        if (!fs.existsSync(filepath)) {
            saveJSONFile(filename, defaultData);
        }
    });
}

// Initialize on module load
initializeDataFiles();

// Menu CRUD operations
function addMenu(params, menus) {
    try {
        if (params.length < 2) {
            return "❌ פורמט שגוי. השתמש: /admin_add_menu [שם_תפריט] [הודעה]";
        }

        const menuName = params[0];
        const message = params.slice(1).join(' ');

        if (menus[menuName]) {
            return `❌ תפריט '${menuName}' כבר קיים. השתמש ב-/admin_update_menu לעדכון.`;
        }

        menus[menuName] = {
            message: message,
            options: {}
        };

        if (saveJSONFile("menus.json", menus)) {
            return `✅ תפריט '${menuName}' נוסף בהצלחה.`;
        }
        return "❌ שגיאה בשמירת התפריט החדש.";
    } catch (error) {
        console.error("Error in addMenu:", error);
        return "❌ שגיאה בהוספת התפריט.";
    }
}

function updateMenu(params, menus) {
    try {
        if (params.length < 2) {
            return "❌ פורמט שגוי. השתמש: /admin_update_menu [שם_תפריט] [הודעה_חדשה]";
        }

        const menuName = params[0];
        const newMessage = params.slice(1).join(' ');

        if (!menus[menuName]) {
            return `❌ תפריט '${menuName}' לא קיים. השתמש ב-/admin_add_menu ליצירה.`;
        }

        menus[menuName].message = newMessage;

        if (saveJSONFile("menus.json", menus)) {
            return `✅ תפריט '${menuName}' עודכן בהצלחה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in updateMenu:", error);
        return "❌ שגיאה בעדכון התפריט.";
    }
}

function deleteMenu(menuName, menus) {
    try {
        if (!menuName) {
            return "❌ פורמט שגוי. השתמש: /admin_delete_menu [שם_תפריט]";
        }

        if (!menus[menuName]) {
            return `❌ תפריט '${menuName}' לא קיים.`;
        }

        if (menuName === 'main') {
            return "❌ לא ניתן למחוק את התפריט הראשי.";
        }

        delete menus[menuName];

        if (saveJSONFile("menus.json", menus)) {
            return `✅ תפריט '${menuName}' נמחק בהצלחה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in deleteMenu:", error);
        return "❌ שגיאה במחיקת התפריט.";
    }
}

function updateMenuOption(params, menus) {
    try {
        if (params.length < 3) {
            return "❌ פורמט שגוי. השתמש: /admin_update_menu_option [מספר] [טקסט_חדש] [תגובה_חדשה]";
        }

        const optionNumber = params[0];
        const newText = params[1];
        const newResponse = params.slice(2).join(' ');

        if (!menus.main.options[optionNumber]) {
            return `❌ אפשרות ${optionNumber} לא קיימת. השתמש ב-/admin_add_menu_option להוספה.`;
        }

        menus.main.options[optionNumber] = {
            text: newText,
            response: newResponse
        };

        if (saveJSONFile("menus.json", menus)) {
            return `✅ אפשרות ${optionNumber} עודכנה בהצלחה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in updateMenuOption:", error);
        return "❌ שגיאה בעדכון אפשרות התפריט.";
    }
}

function listMenuOptions(menuName, menus) {
    try {
        const targetMenu = menuName || 'main';
        
        if (!menus[targetMenu]) {
            return `❌ תפריט '${targetMenu}' לא קיים.`;
        }

        const options = menus[targetMenu].options || {};
        
        if (Object.keys(options).length === 0) {
            return `📋 אין אפשרויות בתפריט '${targetMenu}'.`;
        }

        let response = `📋 *אפשרויות תפריט '${targetMenu}':*\n\n`;
        
        Object.keys(options).sort((a, b) => parseInt(a) - parseInt(b)).forEach(key => {
            const option = options[key];
            response += `${key}. ${option.text}\n`;
            if (option.response) {
                const preview = option.response.length > 50 ? 
                    option.response.substring(0, 50) + "..." : 
                    option.response;
                response += `   📝 תגובה: ${preview}\n`;
            }
            if (option.nextMenu) {
                response += `   ➡️ מוביל לתפריט: ${option.nextMenu}\n`;
            }
            response += "\n";
        });

        return response;
    } catch (error) {
        console.error("Error in listMenuOptions:", error);
        return "❌ שגיאה בהצגת אפשרויות התפריט.";
    }
}

// Course Links CRUD operations
function updateCourseLink(semester, courseNumber, newLink, courseLinks) {
    try {
        if (!semester || !courseNumber || !newLink) {
            return "❌ פרמטרים חסרים. השתמש: /admin_update_course_link [סמסטר] [מספר_קורס] [קישור_חדש]";
        }

        if (!courseLinks[semester] || !courseLinks[semester][courseNumber]) {
            return `❌ קישור לקורס ${courseNumber} בסמסטר ${semester} לא קיים. השתמש ב-/admin_add_course_link להוספה.`;
        }

        courseLinks[semester][courseNumber] = newLink;

        if (saveJSONFile("course_links.json", courseLinks)) {
            return `✅ קישור לקורס ${courseNumber} בסמסטר ${semester} עודכן בהצלחה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in updateCourseLink:", error);
        return "❌ שגיאה בעדכון קישור הקורס.";
    }
}

function listCourseLinks(semester, courseLinks) {
    try {
        if (semester) {
            if (!courseLinks[semester]) {
                return `❌ לא נמצאו קורסים לסמסטר ${semester}.`;
            }

            const courses = courseLinks[semester];
            let response = `📚 *קישורי קורסים לסמסטר ${semester}:*\n\n`;
            
            Object.keys(courses).sort().forEach(courseNum => {
                response += `${courseNum}: ${courses[courseNum]}\n`;
            });

            return response;
        } else {
            if (Object.keys(courseLinks).length === 0) {
                return "📚 אין קישורי קורסים במערכת.";
            }

            let response = "📚 *כל קישורי הקורסים:*\n\n";
            
            Object.keys(courseLinks).sort().forEach(sem => {
                const courses = courseLinks[sem];
                response += `📅 *${sem}:*\n`;
                Object.keys(courses).sort().forEach(courseNum => {
                    response += `  ${courseNum}: ${courses[courseNum]}\n`;
                });
                response += "\n";
            });

            return response;
        }
    } catch (error) {
        console.error("Error in listCourseLinks:", error);
        return "❌ שגיאה בהצגת קישורי הקורסים.";
    }
}

// General Links CRUD operations
async function addGeneralLink(params) {
    try {
        if (params.length < 4) {
            return "❌ פורמט שגוי. השתמש: /admin_add_link [מזהה] [שם] [קישור] [תיאור]";
        }

        const [id, name, url, ...descParts] = params;
        const description = descParts.join(' ');

        let generalLinks = {};
        try {
            const data = fs.readFileSync(path.join(__dirname, "general_links.json"), "utf8");
            generalLinks = JSON.parse(data);
        } catch (error) {
            console.error("Error loading general_links.json:", error);
        }

        if (generalLinks[id]) {
            return `❌ קישור עם מזהה '${id}' כבר קיים. השתמש ב-/admin_update_link לעדכון.`;
        }

        generalLinks[id] = {
            name: name,
            url: url,
            description: description,
            created: new Date().toISOString()
        };

        if (saveJSONFile("general_links.json", generalLinks)) {
            return `✅ קישור '${name}' נוסף בהצלחה עם מזהה '${id}'.`;
        }
        return "❌ שגיאה בשמירת הקישור החדש.";
    } catch (error) {
        console.error("Error in addGeneralLink:", error);
        return "❌ שגיאה בהוספת הקישור.";
    }
}

async function updateGeneralLink(params) {
    try {
        if (params.length < 4) {
            return "❌ פורמט שגוי. השתמש: /admin_update_link [מזהה] [שם_חדש] [קישור_חדש] [תיאור_חדש]";
        }

        const [id, newName, newUrl, ...descParts] = params;
        const newDescription = descParts.join(' ');

        let generalLinks = {};
        try {
            const data = fs.readFileSync(path.join(__dirname, "general_links.json"), "utf8");
            generalLinks = JSON.parse(data);
        } catch (error) {
            console.error("Error loading general_links.json:", error);
        }

        if (!generalLinks[id]) {
            return `❌ קישור עם מזהה '${id}' לא קיים. השתמש ב-/admin_add_link להוספה.`;
        }

        generalLinks[id] = {
            ...generalLinks[id],
            name: newName,
            url: newUrl,
            description: newDescription,
            updated: new Date().toISOString()
        };

        if (saveJSONFile("general_links.json", generalLinks)) {
            return `✅ קישור '${id}' עודכן בהצלחה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in updateGeneralLink:", error);
        return "❌ שגיאה בעדכון הקישור.";
    }
}

async function removeGeneralLink(id) {
    try {
        if (!id) {
            return "❌ פורמט שגוי. השתמש: /admin_remove_link [מזהה]";
        }

        let generalLinks = {};
        try {
            const data = fs.readFileSync(path.join(__dirname, "general_links.json"), "utf8");
            generalLinks = JSON.parse(data);
        } catch (error) {
            console.error("Error loading general_links.json:", error);
        }

        if (!generalLinks[id]) {
            return `❌ קישור עם מזהה '${id}' לא קיים.`;
        }

        const removedName = generalLinks[id].name;
        delete generalLinks[id];

        if (saveJSONFile("general_links.json", generalLinks)) {
            return `✅ קישור '${removedName}' (${id}) נמחק בהצלחה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in removeGeneralLink:", error);
        return "❌ שגיאה במחיקת הקישור.";
    }
}

async function listGeneralLinks() {
    try {
        let generalLinks = {};
        try {
            const data = fs.readFileSync(path.join(__dirname, "general_links.json"), "utf8");
            generalLinks = JSON.parse(data);
        } catch (error) {
            console.error("Error loading general_links.json:", error);
        }

        if (Object.keys(generalLinks).length === 0) {
            return "🔗 אין קישורים כלליים במערכת.";
        }

        let response = "🔗 *קישורים כלליים במערכת:*\n\n";
        
        Object.entries(generalLinks).forEach(([id, link]) => {
            response += `📌 *${link.name}* (${id})\n`;
            response += `🔗 ${link.url}\n`;
            response += `📝 ${link.description}\n`;
            if (link.created) {
                response += `📅 נוצר: ${new Date(link.created).toLocaleDateString('he-IL')}\n`;
            }
            response += "\n";
        });

        return response;
    } catch (error) {
        console.error("Error in listGeneralLinks:", error);
        return "❌ שגיאה בהצגת הקישורים.";
    }
}

// Groups CRUD operations
async function addGroup(params) {
    try {
        if (params.length < 3) {
            return "❌ פורמט שגוי. השתמש: /admin_add_group [מזהה_קבוצה] [שם_קבוצה] [תיאור]";
        }

        const [groupId, groupName, ...descParts] = params;
        const description = descParts.join(' ');

        let groups = {};
        try {
            const data = fs.readFileSync(path.join(__dirname, "groups.json"), "utf8");
            groups = JSON.parse(data);
        } catch (error) {
            console.error("Error loading groups.json:", error);
        }

        if (groups[groupId]) {
            return `❌ קבוצה עם מזהה '${groupId}' כבר קיימת. השתמש ב-/admin_update_group לעדכון.`;
        }

        groups[groupId] = {
            name: groupName,
            description: description,
            created: new Date().toISOString(),
            active: true
        };

        if (saveJSONFile("groups.json", groups)) {
            return `✅ קבוצה '${groupName}' נוספה בהצלחה עם מזהה '${groupId}'.`;
        }
        return "❌ שגיאה בשמירת הקבוצה החדשה.";
    } catch (error) {
        console.error("Error in addGroup:", error);
        return "❌ שגיאה בהוספת הקבוצה.";
    }
}

async function updateGroup(params) {
    try {
        if (params.length < 3) {
            return "❌ פורמט שגוי. השתמש: /admin_update_group [מזהה_קבוצה] [שם_חדש] [תיאור_חדש]";
        }

        const [groupId, newName, ...descParts] = params;
        const newDescription = descParts.join(' ');

        let groups = {};
        try {
            const data = fs.readFileSync(path.join(__dirname, "groups.json"), "utf8");
            groups = JSON.parse(data);
        } catch (error) {
            console.error("Error loading groups.json:", error);
        }

        if (!groups[groupId]) {
            return `❌ קבוצה עם מזהה '${groupId}' לא קיימת. השתמש ב-/admin_add_group להוספה.`;
        }

        groups[groupId] = {
            ...groups[groupId],
            name: newName,
            description: newDescription,
            updated: new Date().toISOString()
        };

        if (saveJSONFile("groups.json", groups)) {
            return `✅ קבוצה '${groupId}' עודכנה בהצלחה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in updateGroup:", error);
        return "❌ שגיאה בעדכון הקבוצה.";
    }
}

async function removeGroup(groupId) {
    try {
        if (!groupId) {
            return "❌ פורמט שגוי. השתמש: /admin_remove_group [מזהה_קבוצה]";
        }

        let groups = {};
        try {
            const data = fs.readFileSync(path.join(__dirname, "groups.json"), "utf8");
            groups = JSON.parse(data);
        } catch (error) {
            console.error("Error loading groups.json:", error);
        }

        if (!groups[groupId]) {
            return `❌ קבוצה עם מזהה '${groupId}' לא קיימת.`;
        }

        const removedName = groups[groupId].name;
        delete groups[groupId];

        if (saveJSONFile("groups.json", groups)) {
            return `✅ קבוצה '${removedName}' (${groupId}) נמחקה בהצלחה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in removeGroup:", error);
        return "❌ שגיאה במחיקת הקבוצה.";
    }
}

async function listGroups() {
    try {
        let groups = {};
        try {
            const data = fs.readFileSync(path.join(__dirname, "groups.json"), "utf8");
            groups = JSON.parse(data);
        } catch (error) {
            console.error("Error loading groups.json:", error);
        }

        if (Object.keys(groups).length === 0) {
            return "👥 אין קבוצות במערכת.";
        }

        let response = "👥 *קבוצות במערכת:*\n\n";
        
        Object.entries(groups).forEach(([id, group]) => {
            const status = group.active ? "🟢" : "🔴";
            response += `${status} *${group.name}* (${id})\n`;
            response += `📝 ${group.description}\n`;
            if (group.created) {
                response += `📅 נוצרה: ${new Date(group.created).toLocaleDateString('he-IL')}\n`;
            }
            response += "\n";
        });

        return response;
    } catch (error) {
        console.error("Error in listGroups:", error);
        return "❌ שגיאה בהצגת הקבוצות.";
    }
}

// Teacher CRUD operations (Update existing)
function updateTeacher(teacherName, newData, teachers) {
    try {
        if (!teacherName || !newData) {
            return "❌ פורמט שגוי. השתמש: /admin_update_teacher [שם_קיים] [נתונים_חדשים_בפורמט_שורות]";
        }

        if (!teachers.teachers) {
            teachers.teachers = [];
        }

        const teacherIndex = teachers.teachers.findIndex(t => t.name === teacherName.trim());
        if (teacherIndex === -1) {
            return `❌ מורה '${teacherName}' לא נמצא. השתמש ב-/admin_add_teacher להוספה.`;
        }

        // Parse new data in the same format as addTeacher
        const parts = newData.split(/\r?\n/).map(p => p.trim()).filter(Boolean);
        
        if (parts.length !== 6) {
            return "❌ פורמט שגוי – חייבות להיות בדיוק 6 שורות.\n\nדוגמה:\n[שם]\n[קורסים]\n[מחיר]\n[טלפון]\n[תקציר]\n[רמת_הוראה]";
        }

        const [name, courses, price, phone, summary, teachingLevel] = parts;
        const teachingArray = courses.split(',').map(c => c.trim());
        const validLevels = ["סטודנטים", "תלמידי תיכון"];
        
        if (!validLevels.includes(teachingLevel)) {
            return `❌ רמת הוראה לא חוקית. השתמש: ${validLevels.join(" / ")}`;
        }

        teachers.teachers[teacherIndex] = {
            name,
            teaching: teachingArray,
            price,
            phone,
            summary,
            teachingLevel
        };

        if (saveJSONFile("teachers.json", teachers)) {
            return `✅ מורה '${name}' עודכן בהצלחה.\n🎯 רמה: ${teachingLevel}\n📚 מלמד: ${teachingArray.join(", ")}`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in updateTeacher:", error);
        return "❌ שגיאה בעדכון המורה.";
    }
}

// Blacklist CRUD operations
async function removeFromBlacklist(userId) {
    try {
        let blacklist = [];
        try {
            const blacklistData = fs.readFileSync(path.join(__dirname, 'blacklist.json'), 'utf8');
            blacklist = JSON.parse(blacklistData);
        } catch (error) {
            console.error('Error loading blacklist:', error);
            return "❌ שגיאה בטעינת הרשימה השחורה.";
        }

        const index = blacklist.indexOf(userId);
        if (index === -1) {
            return `ℹ️ משתמש ${userId} לא נמצא ברשימה השחורה.`;
        }

        blacklist.splice(index, 1);

        if (saveJSONFile("blacklist.json", blacklist)) {
            return `✅ משתמש ${userId} הוסר מהרשימה השחורה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error('Error removing from blacklist:', error);
        return "❌ שגיאה בהסרה מהרשימה השחורה.";
    }
}

async function listBlacklist() {
    try {
        let blacklist = [];
        try {
            const blacklistData = fs.readFileSync(path.join(__dirname, 'blacklist.json'), 'utf8');
            blacklist = JSON.parse(blacklistData);
        } catch (error) {
            console.error('Error loading blacklist:', error);
            return "❌ שגיאה בטעינת הרשימה השחורה.";
        }

        if (blacklist.length === 0) {
            return "🛡️ הרשימה השחורה ריקה.";
        }

        let response = `🛡️ *רשימה שחורה (${blacklist.length} משתמשים):*\n\n`;
        blacklist.forEach((userId, index) => {
            response += `${index + 1}. ${userId}\n`;
        });

        return response;
    } catch (error) {
        console.error('Error listing blacklist:', error);
        return "❌ שגיאה בהצגת הרשימה השחורה.";
    }
}

// Keep all existing functions
async function reloadData(menus, teachers, courseLinks, groupMembersPath, groupMembers, scanGroupMembers) {
    try {
        const menusData = fs.readFileSync(path.join(__dirname, "menus.json"), "utf8");
        Object.assign(menus, JSON.parse(menusData));

        const teachersData = fs.readFileSync(path.join(__dirname, "teachers.json"), "utf8");
        Object.assign(teachers, JSON.parse(teachersData));

        const courseLinksData = fs.readFileSync(path.join(__dirname, "course_links.json"), "utf8");
        Object.assign(courseLinks, JSON.parse(courseLinksData));

        console.log("Reloading group members...");
        await scanGroupMembers();

        const groupMembersData = fs.readFileSync(groupMembersPath, "utf8");
        groupMembers.length = 0;
        groupMembers.push(...JSON.parse(groupMembersData));

        return true;
    } catch (error) {
        console.error("Error reloading data:", error);
        return false;
    }
}

function isUserInGroup(userId, groupMembersPath) {
    try {
        const data = fs.readFileSync(groupMembersPath, "utf8");
        const currentGroupMembers = JSON.parse(data);
        return currentGroupMembers.includes(userId);
    } catch (error) {
        console.error("Error checking group membership:", error);
        return false;
    }
}

async function getGroupParticipants(groupId, client) {
  try {
    console.log(`Getting participants for group: ${groupId}`);
    
    const participants = await client.pupPage.evaluate(async (gid) => {
      try {
        const chat = await window.Store.Chat.get(gid);
        if (!chat) {
          return { error: `Chat not found: ${gid}` };
        }

        const groupName = chat.name || "Unknown Group";
        
        // Defensive participant handling
        let participants = [];
        if (chat.groupMetadata && chat.groupMetadata.participants) {
          const rawParticipants = chat.groupMetadata.participants.getModelsArray();
          
          participants = rawParticipants
            .filter(p => p && p.id) // Filter out null/undefined participants
            .map(p => {
              try {
                return {
                  id: p.id && p.id._serialized ? p.id._serialized : 'unknown',
                  isAdmin: Boolean(p.isAdmin),
                  isSuperAdmin: Boolean(p.isSuperAdmin)
                };
              } catch (mapError) {
                console.warn('Error processing participant:', mapError);
                return null;
              }
            })
            .filter(p => p !== null && p.id !== 'unknown'); // Remove failed mappings
        }

        return {
          name: groupName,
          participants: participants
        };
      } catch (error) {
        return { 
          error: error.message, 
          stack: error.stack,
          name: "Error processing group"
        };
      }
    }, groupId);

    if (participants.error) {
      console.error(`Error getting participants: ${participants.error}`);
      return { name: "Error", participants: [] };
    }

    console.log(`Group: ${participants.name} | Total participants: ${participants.participants.length}`);
    return participants;
    
  } catch (error) {
    console.error(`Error in getGroupParticipants: ${error.message}`);
    return { name: "Error", participants: [] };
  }
}

async function getParticipantsForGroup(groupId, client) {
    try {
        console.log(`Getting participants for group: ${groupId}`);
        const chat = await client.getChatById(groupId);
        if (!chat) {
            console.error(`Chat not found: ${groupId}`);
            return { name: "Unknown", participants: [] };
        }

        console.log(`Found group: ${chat.name}`);
        if (typeof chat.fetchParticipants === 'function') {
            try {
                console.log("Fetching latest participants data...");
                await chat.fetchParticipants();
            } catch (e) {
                console.error(`Error fetching participants: ${e.message}`);
            }
        }

        const participants = chat.participants || [];
        console.log(`Total participants: ${participants.length}`);

        const formattedParticipants = participants.map((participant, index) => {
            try {
                const id = participant.id._serialized || "Unknown ID";
                const isAdmin = participant.isAdmin || false;
                const isSuperAdmin = participant.isSuperAdmin || false;
                console.log(`User ${index + 1}: ${id} (${isAdmin ? 'Admin' : 'Member'})`);
                return {
                    id: id,
                    isAdmin: isAdmin,
                    isSuperAdmin: isSuperAdmin
                };
            } catch (e) {
                console.log(`User ${index + 1}: Error getting details - ${e.message}`);
                return {
                    id: "Unknown",
                    isAdmin: false,
                    isSuperAdmin: false
                };
            }
        });

        return {
            name: chat.name || "Unknown Group",
            participants: formattedParticipants
        };
    } catch (error) {
        console.error(`Error in getParticipantsForGroup: ${error.message}`);
        console.error(`Stack trace: ${error.stack}`);
        return { name: "Error", participants: [] };
    }
}

async function scanGroupMembers(client, groupMembersPath, groupMembers) {
  try {
    console.log("Starting group member scan...");
    const chats = await client.getChats();
    const groups = chats.filter(chat => {
      try {
        return chat && chat.isGroup !== undefined ? chat.isGroup : 
               (chat.id && chat.id._serialized && chat.id._serialized.endsWith('@g.us'));
      } catch (e) {
        return false;
      }
    });
    
    console.log(`Found ${groups.length} groups to scan`);
    const uniqueUsers = new Set();
    const failedGroups = [];

    for (const group of groups) {
      try {
        console.log(`Processing group: ${group.name} (${group.id._serialized})`);
        
        // Multiple retry attempts for each group
        let participants = [];
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            const result = await getGroupParticipants(group.id._serialized, client);
            participants = result.participants;
            
            if (participants.length > 0) {
              break; // Success, exit retry loop
            }
          } catch (retryError) {
            console.warn(`Retry ${retryCount + 1} failed for ${group.name}:`, retryError.message);
          }
          
          retryCount++;
          if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
          }
        }

        if (participants.length === 0) {
          failedGroups.push(group.name);
          console.warn(`Failed to get participants for group: ${group.name} after ${maxRetries} attempts`);
          continue;
        }

        participants.forEach(p => {
          if (p.id && p.id !== "Unknown ID" && p.id !== "Unknown") {
            uniqueUsers.add(p.id);
          }
        });

        console.log(`Successfully scanned ${participants.length} members from group`);
        
      } catch (groupError) {
        console.error(`Error processing group ${group.name}: ${groupError.message}`);
        failedGroups.push(group.name);
      }
    }

    const phoneNumbers = Array.from(uniqueUsers);
    fs.writeFileSync(groupMembersPath, JSON.stringify(phoneNumbers, null, 2));
    groupMembers.length = 0;
    groupMembers.push(...phoneNumbers);

    console.log("Group scan completed!");
    console.log(`Total unique phone numbers found: ${phoneNumbers.length}`);
    
    let result = `✅ סריקת קבוצות הושלמה בהצלחה!\n👥 נמצאו ${phoneNumbers.length} מספרי טלפון ייחודיים\n💾 הנתונים נשמרו ב-data/group_members.json`;
    
    if (failedGroups.length > 0) {
      result += `\n⚠️ ${failedGroups.length} קבוצות נכשלו: ${failedGroups.join(', ')}`;
    }
    
    return result;
    
  } catch (error) {
    console.error('Error scanning groups:', error);
    return '❌ שגיאה בסריקת הקבוצות. אנא נסה שוב.';
  }
}
async function broadcastMessage(message, botChatsPath, client) {
    try {
        console.log("Starting broadcast message...");
        let botChatsData = {};
        try {
            const data = fs.readFileSync(botChatsPath, 'utf8');
            botChatsData = JSON.parse(data);
        } catch (error) {
            console.error("Error loading bot_chats.json:", error);
            return "❌ שגיאה בטעינת נתוני המשתמשים.";
        }

        const phoneNumbers = Object.keys(botChatsData);
        if (phoneNumbers.length === 0) {
            return "❌ לא נמצאו משתמשים לשליחת הודעה.";
        }

        console.log(`Found ${phoneNumbers.length} users to send broadcast to`);
        let successCount = 0;
        let failureCount = 0;
        const errors = [];

        for (const phoneNumber of phoneNumbers) {
            try {
                const userId = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
                await new Promise(resolve => setTimeout(resolve, 2500));
                await client.sendMessage(userId, `📢 *הודעה כללית*\n\n${message}`);
                successCount++;
                console.log(`Successfully sent broadcast to ${phoneNumber}`);
            } catch (error) {
                failureCount++;
                const errorMsg = `Failed to send to ${phoneNumber}: ${error.message}`;
                errors.push(errorMsg);
                console.error(errorMsg);
            }
        }

        let report = `📊 *דוח שידור הודעה*\n\n`;
        report += `✅ נשלח בהצלחה: ${successCount}\n`;
        report += `❌ נכשל: ${failureCount}\n`;
        report += `📱 סך המשתמשים: ${phoneNumbers.length}\n\n`;

        if (errors.length > 0 && errors.length <= 5) {
            report += `🔍 *שגיאות:*\n`;
            errors.slice(0, 5).forEach((error, index) => {
                report += `${index + 1}. ${error}\n`;
            });
        } else if (errors.length > 5) {
            report += `🔍 *שגיאות:* ${errors.length} שגיאות (מוצגות 5 ראשונות)\n`;
            errors.slice(0, 5).forEach((error, index) => {
                report += `${index + 1}. ${error}\n`;
            });
        }

        console.log("Broadcast completed!");
        return report;
    } catch (error) {
        console.error('Error in broadcast function:', error);
        return '❌ שגיאה כללית בשליחת ההודעה הכללית.';
    }
}

async function resolveLidToPhone(lidId, client) {
    try {
        if (!lidId.includes('@lid')) {
            return `❌ ${lidId} is not a valid @lid format`;
        }

        let results = [];
        try {
            const contact = await client.getContactById(lidId);
            if (contact && contact.number) {
                results.push(`Contact number: ${contact.number}@c.us`);
            }
            if (contact && contact.pushname) {
                results.push(`Contact name: ${contact.pushname}`);
            }
        } catch (error) {
            results.push(`getContactById failed: ${error.message}`);
        }

        try {
            const chat = await client.getChatById(lidId);
            if (chat && chat.id && chat.id.user) {
                results.push(`Chat user: ${chat.id.user}@c.us`);
            }
            if (chat && chat.name) {
                results.push(`Chat name: ${chat.name}`);
            }
        } catch (error) {
            results.push(`getChatById failed: ${error.message}`);
        }

        if (results.length === 0) {
            return `❌ Could not resolve ${lidId} to phone number`;
        }

        return `🔍 *Resolution results for ${lidId}:*\n${results.join('\n')}`;
    } catch (error) {
        console.error('Error resolving @lid:', error);
        return `❌ Error resolving ${lidId}: ${error.message}`;
    }
}

async function addToBlacklist(userId, client) {
    try {
        console.log(`[DEBUG] Starting addToBlacklist for userId: ${userId}`);
        await cleanupBlacklist();
        let blacklist = [];
        const blacklistPath = path.join(__dirname, 'blacklist.json');
        
        try {
            const blacklistData = fs.readFileSync(blacklistPath, 'utf8');
            blacklist = JSON.parse(blacklistData);
            console.log(`[DEBUG] Current blacklist loaded, length: ${blacklist.length}`);
        } catch (error) {
            console.error('[DEBUG] Error loading blacklist:', error);
            blacklist = [];
        }

        // CRITICAL FIX: Remove duplicates from existing blacklist first
        blacklist = [...new Set(blacklist)];
        console.log(`[DEBUG] Duplicates removed, new length: ${blacklist.length}`);

        let addedIds = [];
        
        // Normalize the userId
        let normalizedUserId = userId;
        if (!userId.includes('@') && !isNaN(userId.replace(/[^\d]/g, ''))) {
            normalizedUserId = `${userId}@c.us`;
            console.log(`[DEBUG] Normalized userId from ${userId} to ${normalizedUserId}`);
        }

        if (userId.includes('@lid')) {
            // Handle @lid resolution
            try {
                const contact = await client.getContactById(userId);
                if (contact && contact.number) {
                    const phoneWithSuffix = `${contact.number}@c.us`;
                    // FIXED: Proper duplicate check
                    if (!blacklist.includes(phoneWithSuffix)) {
                        blacklist.push(phoneWithSuffix);
                        addedIds.push(phoneWithSuffix);
                        console.log(`[DEBUG] Added resolved contact number: ${phoneWithSuffix}`);
                    }
                }

                const chat = await client.getChatById(userId);
                if (chat && chat.id && chat.id.user) {
                    const phoneWithSuffix = `${chat.id.user}@c.us`;
                    // FIXED: Proper duplicate check
                    if (!blacklist.includes(phoneWithSuffix)) {
                        blacklist.push(phoneWithSuffix);
                        addedIds.push(phoneWithSuffix);
                        console.log(`[DEBUG] Added resolved chat user: ${phoneWithSuffix}`);
                    }
                }

                // FIXED: Proper duplicate check for original @lid
                if (!blacklist.includes(userId)) {
                    blacklist.push(userId);
                    addedIds.push(userId);
                    console.log(`[DEBUG] Added original @lid: ${userId}`);
                }

            } catch (error) {
                console.log(`[DEBUG] Could not resolve ${userId}, adding as-is:`, error.message);
                // FIXED: Proper duplicate check
                if (!blacklist.includes(userId)) {
                    blacklist.push(userId);
                    addedIds.push(userId);
                }
            }
        } else {
            // Handle regular phone numbers
            // FIXED: Proper duplicate check
            if (!blacklist.includes(normalizedUserId)) {
                blacklist.push(normalizedUserId);
                addedIds.push(normalizedUserId);
                console.log(`[DEBUG] Added normalized userId: ${normalizedUserId}`);
            } else {
                console.log(`[DEBUG] User ${normalizedUserId} already in blacklist`);
            }
        }

        console.log(`[DEBUG] Final blacklist length: ${blacklist.length}`);
        console.log(`[DEBUG] Added IDs: ${addedIds.join(', ')}`);

        if (addedIds.length > 0) {
            const saveResult = saveJSONFile("blacklist.json", blacklist);
            console.log(`[DEBUG] Save result: ${saveResult}`);
            
            if (saveResult) {
                return `✅ Added to blacklist: ${addedIds.join(', ')}`;
            } else {
                return "❌ Error saving blacklist - check console for details";
            }
        } else {
            return "ℹ️ User already in blacklist";
        }

    } catch (error) {
        console.error('[ERROR] Error adding to blacklist:', error);
        return `❌ Error adding to blacklist: ${error.message}`;
    }
}
async function cleanupBlacklist() {
    try {
        const blacklistPath = path.join(__dirname, 'blacklist.json');
        const blacklistData = fs.readFileSync(blacklistPath, 'utf8');
        const blacklist = JSON.parse(blacklistData);
        
        // Remove duplicates using Set
        const uniqueBlacklist = [...new Set(blacklist)];
        
        console.log(`Removed ${blacklist.length - uniqueBlacklist.length} duplicates`);
        console.log(`Original length: ${blacklist.length}, New length: ${uniqueBlacklist.length}`);
        
        if (saveJSONFile("blacklist.json", uniqueBlacklist)) {
            return `✅ Blacklist cleaned: removed ${blacklist.length - uniqueBlacklist.length} duplicates`;
        }
        
        return "❌ Error saving cleaned blacklist";
    } catch (error) {
        console.error('Error cleaning blacklist:', error);
        return `❌ Error cleaning blacklist: ${error.message}`;
    }
}
function addTeacher(teacherData, teachers) {
  try {
    // מפרידים לפי שורות, מסירים רווחים ושורות ריקות
    const parts = teacherData
      .split(/\r?\n/)           // גם \r\n וגם \n
      .map(p => p.trim())
      .filter(Boolean);

    if (parts.length !== 6) {
      return (
        "❌ פורמט שגוי – חייבות להיות בדיוק 6 שורות.\n\n" +
        "דוגמה:\n" +
        "/admin_add_teacher\n" +
        "דוד לוי\n" +
        "101,102\n" +
        "200 ש\"ח לשעה\n" +
        "050-1234567\n" +
        "מורה מנוסה\n" +
        "סטודנטים"
      );
    }

    const [name, courses, price, phone, summary, teachingLevel] = parts;
    const teachingArray = courses.split(',').map(c => c.trim());

    const validLevels = ["סטודנטים", "תלמידי תיכון"];
    if (!validLevels.includes(teachingLevel)) {
      return `❌ רמת הוראה לא חוקית. השתמש: ${validLevels.join(" / ")}`;
    }

    const newTeacher = {
      name,
      teaching: teachingArray,
      price,
      phone,
      summary,
      teachingLevel
    };

    if (!teachers.teachers) teachers.teachers = [];

    const idx = teachers.teachers.findIndex(t => t.name === newTeacher.name);
    if (idx !== -1) teachers.teachers[idx] = newTeacher;
    else             teachers.teachers.push(newTeacher);

    if (saveJSONFile("teachers.json", teachers)) {
      const action = idx === -1 ? "נוסף" : "עודכן";
      return `✅ מורה ${newTeacher.name} ${action} בהצלחה.\n🎯 רמה: ${newTeacher.teachingLevel}\n📚 מלמד: ${newTeacher.teaching.join(", ")}`;
    }
    return "❌ שגיאה בשמירת המורה.";

  } catch (err) {
    console.error("Error in addTeacher:", err);
    return "❌ שגיאה בעיבוד נתוני המורה.";
  }
}
exports.addTeacher = addTeacher;

function removeTeacher(teacherName, teachers) {
    try {
        if (!teachers.teachers) {
            return "❌ לא נמצאו מורים במערכת.";
        }

        const teacherToRemove = teachers.teachers.find(t => t.name === teacherName.trim());
        if (!teacherToRemove) {
            return `❌ מורה ${teacherName} לא נמצא.`;
        }

        const initialLength = teachers.teachers.length;
        teachers.teachers = teachers.teachers.filter(t => t.name !== teacherName.trim());

        if (teachers.teachers.length < initialLength) {
            if (saveJSONFile("teachers.json", teachers)) {
                return `✅ מורה ${teacherName} הוסר בהצלחה.\n🎯 היה מלמד ברמה: ${teacherToRemove.teachingLevel}`;
            }
            return "❌ שגיאה בשמירת השינויים.";
        }

        return `❌ מורה ${teacherName} לא נמצא.`;
    } catch (error) {
        console.error("Error in removeTeacher:", error);
        return "❌ שגיאה בהסרת המורה.";
    }
}

function listTeachers(teachers) {
    try {
        if (!teachers.teachers || teachers.teachers.length === 0) {
            return "📋 אין מורים רשומים במערכת.";
        }

        let response = "👨🏫 *רשימת מורים במערכת:*\n\n";

        const studentTeachers = teachers.teachers.filter(t => t.teachingLevel === "סטודנטים");
        const highSchoolTeachers = teachers.teachers.filter(t => t.teachingLevel === "תלמידי תיכון");

        if (studentTeachers.length > 0) {
            response += "🎓 *מורים לסטודנטים:*\n";
            studentTeachers.forEach((teacher, index) => {
                response += `${index + 1}. *${teacher.name}*\n`;
                response += ` 📚 מלמד: ${teacher.teaching.join(", ")}\n`;
                response += ` 💰 מחיר: ${teacher.price}\n`;
                response += ` 📞 טלפון: ${teacher.phone}\n`;
                response += ` 🎯 רמה: ${teacher.teachingLevel}\n\n`;
            });
        }

        if (highSchoolTeachers.length > 0) {
            response += "🏫 *מורים לתלמידי תיכון:*\n";
            highSchoolTeachers.forEach((teacher, index) => {
                response += `${index + 1}. *${teacher.name}*\n`;
                response += ` 📚 מלמד: ${teacher.teaching.join(", ")}\n`;
                response += ` 💰 מחיר: ${teacher.price}\n`;
                response += ` 📞 טלפון: ${teacher.phone}\n`;
                response += ` 🎯 רמה: ${teacher.teachingLevel}\n\n`;
            });
        }

        response += `📊 *סיכום:*\n`;
        response += `🎓 מורים לסטודנטים: ${studentTeachers.length}\n`;
        response += `🏫 מורים לתלמידי תיכון: ${highSchoolTeachers.length}\n`;
        response += `📋 סך הכל מורים: ${teachers.teachers.length}`;

        return response;
    } catch (error) {
        console.error("Error in listTeachers:", error);
        return "❌ שגיאה בהצגת רשימת המורים.";
    }
}

function addMenuOption(params, menus) {
    try {
        if (params.length < 3) {
            return "❌ פורמט שגוי. השתמש: /admin_add_menu_option [מספר] [טקסט] [תגובה]";
        }

        const optionNumber = params[0];
        const optionText = params[1];
        const response = params.slice(2).join(' ');

        if (!menus.main.options) {
            menus.main.options = {};
        }

        menus.main.options[optionNumber] = {
            text: optionText,
            response: response
        };

        updateMainMenuMessage(menus);

        if (saveJSONFile("menus.json", menus)) {
            return `✅ אפשרות ${optionNumber} (${optionText}) נוספה בהצלחה.`;
        }

        return "❌ שגיאה בשמירת האפשרות החדשה.";
    } catch (error) {
        return "❌ שגיאה בהוספת אפשרות התפריט.";
    }
}

function removeMenuOption(optionNumber, menus) {
    try {
        if (!menus.main.options || !menus.main.options[optionNumber]) {
            return `❌ אפשרות ${optionNumber} לא קיימת.`;
        }

        const removedOption = menus.main.options[optionNumber].text;
        delete menus.main.options[optionNumber];

        updateMainMenuMessage(menus);

        if (saveJSONFile("menus.json", menus)) {
            return `✅ אפשרות ${optionNumber} (${removedOption}) הוסרה בהצלחה.`;
        }

        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        return "❌ שגיאה בהסרת אפשרות התפריט.";
    }
}

function updateMainMenuMessage(menus) {
    let message = "*🤖 תפריט ראשי*\n\nברוכים הבאים! אנא בחרו מהאפשרויות הבאות:\n\n";
    Object.keys(menus.main.options).sort((a, b) => parseInt(a) - parseInt(b)).forEach(key => {
        message += `${key}. ${menus.main.options[key].text}\n`;
    });
    message += "\nאנא השיבו עם המספר של בחירתכם.";
    menus.main.message = message;
}

function updateMenuMessage(menuName, newMessage, menus) {
    try {
        if (!menuName || menuName.trim() === '') {
            return "❌ שם תפריט לא יכול להיות ריק. השתמש: /admin_update_menu_message [שם_תפריט] [הודעה_חדשה]";
        }

        if (!newMessage || newMessage.trim() === '') {
            return "❌ הודעה חדשה לא יכולה להיות ריקה.";
        }

        const menuKey = menuName.trim();
        if (!menus[menuKey]) {
            return `❌ תפריט '${menuKey}' לא קיים. השתמש ב-/admin_list_menus לרואת תפריטים זמינים.`;
        }

        menus[menuKey].message = newMessage.trim();

        if (saveJSONFile("menus.json", menus)) {
            return `✅ הודעת התפריט '${menuKey}' עודכנה בהצלחה.`;
        }

        return "❌ שגיאה בשמירת ההודעה החדשה.";
    } catch (error) {
        return "❌ שגיאה בעדכון הודעת התפריט.";
    }
}

function listMenus(menus) {
    try {
        if (!menus || Object.keys(menus).length === 0) {
            return "❌ לא נמצאו תפריטים במערכת.";
        }

        let response = "📋 *תפריטים זמינים במערכת:*\n\n";
        Object.keys(menus).forEach((menuKey, index) => {
            const menu = menus[menuKey];
            response += `${index + 1}. *${menuKey}*\n`;
            const messagePreview = menu.message.length > 100 ?
                menu.message.substring(0, 100) + "..." :
                menu.message;
            response += ` 📝 הודעה: ${messagePreview}\n`;
            response += ` 🔢 אפשרויות: ${Object.keys(menu.options || {}).length}\n\n`;
        });

        response += "*להודעת תפריט מלאה:*\n";
        response += "`/admin_update_menu_message [שם_תפריט] [הודעה_חדשה]`\n\n";
        response += "*תפריטים זמינים לעדכון:*\n";
        Object.keys(menus).forEach(menuKey => {
            response += `• ${menuKey}\n`;
        });

        return response;
    } catch (error) {
        return "❌ שגיאה בהצגת רשימת התפריטים.";
    }
}

function addCourseLink(semester, courseNumber, link, courseLinks) {
    try {
        if (!semester || !courseNumber || !link) {
            return "❌ פרמטרים חסרים. השתמש: /admin_add_course_link [סמסטר] [מספר_קורס] [קישור]";
        }

        if (!courseLinks[semester]) {
            courseLinks[semester] = {};
        }

        courseLinks[semester][courseNumber] = link;

        if (saveJSONFile("course_links.json", courseLinks)) {
            return `✅ קישור לקורס ${courseNumber} בסמסטר ${semester} נוסף בהצלחה.`;
        }

        return "❌ שגיאה בשמירת הקישור.";
    } catch (error) {
        return "❌ שגיאה בהוספת קישור הקורס.";
    }
}

function removeCourseLink(semester, courseNumber, courseLinks) {
    try {
        if (!semester || !courseNumber) {
            return "❌ פרמטרים חסרים. השתמש: /admin_remove_course_link [סמסטר] [מספר_קורס]";
        }

        if (!courseLinks[semester] || !courseLinks[semester][courseNumber]) {
            return `❌ קישור לקורס ${courseNumber} בסמסטר ${semester} לא קיים.`;
        }

        delete courseLinks[semester][courseNumber];

        if (Object.keys(courseLinks[semester]).length === 0) {
            delete courseLinks[semester];
        }

        if (saveJSONFile("course_links.json", courseLinks)) {
            return `✅ קישור לקורס ${courseNumber} בסמסטר ${semester} הוסר בהצלחה.`;
        }

        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        return "❌ שגיאה בהסרת קישור הקורס.";
    }
}

async function approveGroupRequests(groupId = null, options = {}, client) {
    try {
        let blacklist = [];
        try {
            const blacklistData = fs.readFileSync(path.join(__dirname, 'blacklist.json'), 'utf8');
            blacklist = JSON.parse(blacklistData);
        } catch (error) {
            console.error('Error loading blacklist:', error);
            blacklist = [];
        }

        if (groupId) {
            const chat = await client.getChatById(groupId);
            const botContact = await client.getContactById(client.info.wid._serialized);
            const isAdmin = chat.participants.some(p =>
                p.id._serialized === botContact.id._serialized &&
                (p.isAdmin || p.isSuperAdmin)
            );

            if (!isAdmin) {
                return `❌ Bot is not admin in group ${groupId}`;
            }

            const membershipRequests = await client.getGroupMembershipRequests(groupId);
            if (membershipRequests.length === 0) {
                return `✅ No pending membership requests for group ${groupId}`;
            }

            console.log('Raw membership requests:', JSON.stringify(membershipRequests, null, 2));

            const allowedRequesterIds = [];
            const blockedRequesters = [];

            for (const request of membershipRequests) {
                let requesterId = null;
                try {
                    if (typeof request.author === 'string') {
                        requesterId = request.author;
                    } else if (request.author && request.author._serialized) {
                        requesterId = request.author._serialized;
                    } else if (request.id && typeof request.id === 'string') {
                        requesterId = request.id;
                    } else if (request.id && request.id._serialized) {
                        requesterId = request.id._serialized;
                    } else if (request.requester) {
                        if (typeof request.requester === 'string') {
                            requesterId = request.requester;
                        } else if (request.requester._serialized) {
                            requesterId = request.requester._serialized;
                        }
                    } else if (request.addedBy) {
                        if (typeof request.addedBy === 'string') {
                            requesterId = request.addedBy;
                        } else if (request.addedBy._serialized) {
                            requesterId = request.addedBy._serialized;
                        }
                    }

                    console.log(`Extracted requester ID: ${requesterId} from request:`, request);
                    if (requesterId) {
                        if (!blacklist.includes(requesterId)) {
                            allowedRequesterIds.push(requesterId);
                        } else {
                            blockedRequesters.push(requesterId);
                            console.log(`Blocked requester: ${requesterId} (in blacklist)`);
                        }
                    } else {
                        console.error('Could not extract requester ID from request:', request);
                    }
                } catch (extractionError) {
                    console.error('Error extracting requester ID:', extractionError);
                    console.error('Request object:', request);
                }
            }

            if (allowedRequesterIds.length === 0) {
                const totalBlocked = blockedRequesters.length;
                const totalFailed = membershipRequests.length - blockedRequesters.length;
                return `⚠️ No valid requests to approve. Blacklisted: ${totalBlocked}, Failed to process: ${totalFailed}`;
            }

            console.log(`Approving ${allowedRequesterIds.length} requests:`, allowedRequesterIds);

            try {
                const results = await client.approveGroupMembershipRequests(groupId, {
                    requesterIds: allowedRequesterIds,
                    ...options
                });
                const blockedCount = blockedRequesters.length;
                return `✅ Processed ${results.length} membership requests for group ${groupId}\n` +
                    `📋 Approved: ${allowedRequesterIds.length}\n` +
                    `🚫 Blocked (blacklisted): ${blockedCount}`;
            } catch (approvalError) {
                console.error('Error during approval:', approvalError);
                console.error('Attempted to approve IDs:', allowedRequesterIds);

                let successCount = 0;
                for (const id of allowedRequesterIds) {
                    try {
                        await client.approveGroupMembershipRequests(groupId, {
                            requesterIds: [id]
                        });
                        successCount++;
                    } catch (individualError) {
                        console.error(`Failed to approve ${id}:`, individualError.message);
                    }
                }

                return `⚠️ Partial approval: ${successCount}/${allowedRequesterIds.length} approved\n` +
                    `🚫 Blocked (blacklisted): ${blockedRequesters.length}\n` +
                    `❌ Some requests failed. See console for details.`;
            }
        } else {
            const chats = await client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            let totalApproved = 0;
            let totalBlocked = 0;
            let adminGroups = 0;
            let nonAdminGroups = 0;
            let processedGroups = [];

            for (const group of groups) {
                try {
                    const botContact = await client.getContactById(client.info.wid._serialized);
                    const isAdmin = group.participants.some(p =>
                        p.id._serialized === botContact.id._serialized &&
                        (p.isAdmin || p.isSuperAdmin)
                    );

                    if (isAdmin) {
                        adminGroups++;
                        const membershipRequests = await client.getGroupMembershipRequests(group.id._serialized);
                        
                        if (membershipRequests.length > 0) {
                            console.log(`Processing ${membershipRequests.length} requests for group ${group.name}`);
                            const allowedRequesterIds = [];
                            const blockedRequesters = [];

                            for (const request of membershipRequests) {
                                let requesterId = null;
                                try {
                                    if (typeof request.author === 'string') {
                                        requesterId = request.author;
                                    } else if (request.author && request.author._serialized) {
                                        requesterId = request.author._serialized;
                                    } else if (request.id && typeof request.id === 'string') {
                                        requesterId = request.id;
                                    } else if (request.id && request.id._serialized) {
                                        requesterId = request.id._serialized;
                                    } else if (request.requester) {
                                        if (typeof request.requester === 'string') {
                                            requesterId = request.requester;
                                        } else if (request.requester._serialized) {
                                            requesterId = request.requester._serialized;
                                        }
                                    } else if (request.addedBy) {
                                        if (typeof request.addedBy === 'string') {
                                            requesterId = request.addedBy;
                                        } else if (request.addedBy._serialized) {
                                            requesterId = request.addedBy._serialized;
                                        }
                                    }

                                    if (requesterId) {
                                        if (!blacklist.includes(requesterId)) {
                                            allowedRequesterIds.push(requesterId);
                                        } else {
                                            blockedRequesters.push(requesterId);
                                        }
                                    }
                                } catch (extractionError) {
                                    console.error(`Error extracting requester ID in group ${group.name}:`, extractionError);
                                }
                            }

                            const blockedCount = blockedRequesters.length;
                            totalBlocked += blockedCount;

                            if (allowedRequesterIds.length > 0) {
                                try {
                                    const results = await client.approveGroupMembershipRequests(group.id._serialized, {
                                        requesterIds: allowedRequesterIds,
                                        ...options
                                    });
                                    totalApproved += results.length;
                                    processedGroups.push(`${group.name}: approved ${results.length}, blocked ${blockedCount}`);
                                    console.log(`Approved ${results.length} requests in ${group.name} (blocked ${blockedCount} blacklisted users)`);
                                } catch (approvalError) {
                                    console.error(`Error approving requests for ${group.name}:`, approvalError.message);
                                    processedGroups.push(`${group.name}: error - ${approvalError.message}`);
                                }
                            } else {
                                processedGroups.push(`${group.name}: no valid requests (${membershipRequests.length} total)`);
                                console.log(`Skipped ${group.name} - no valid requests to approve`);
                            }
                        }
                    } else {
                        nonAdminGroups++;
                        console.log(`Skipped ${group.name} - bot not admin`);
                    }
                } catch (error) {
                    console.error(`Error processing ${group.name}:`, error.message);
                    console.error('Full error:', error);
                }
            }

            let report = `✅ Approved ${totalApproved} total requests across ${adminGroups} groups\n` +
                `🚫 Blocked ${totalBlocked} blacklisted users\n` +
                `⚠️ Skipped ${nonAdminGroups} groups (not admin)`;

            if (processedGroups.length > 0) {
                report += `\n\n📋 Group Details:\n${processedGroups.join('\n')}`;
            }

            return report;
        }
    } catch (error) {
        console.error('Error approving membership requests:', error);
        console.error('Error stack:', error.stack);
        return '❌ Error processing membership requests with blacklist filtering';
    }
}

function updateUserInteraction(userId, botChatsPath) {
    try {
        if (userId.includes('@g.us') || userId === 'status@broadcast') return;

        let botChats = {};
        try {
            const data = fs.readFileSync(botChatsPath, 'utf8');
            botChats = JSON.parse(data);
        } catch (error) {
            console.error("Error loading bot_chats.json:", error);
        }

        const phoneNumber = userId.split('@')[0];
        botChats[phoneNumber] = new Date().toISOString();
        fs.writeFileSync(botChatsPath, JSON.stringify(botChats, null, 2));
    } catch (error) {
        console.error("Error updating user interaction:", error);
    }
}

function createMenu(userId, userSessions, menus) {
    const session = userSessions.get(userId);
    if (session && menus[session.currentMenu]) {
        return menus[session.currentMenu].message;
    } else {
        return menus.main.message;
    }
}

function addHighSchoolSubject(params, menus) {
    const parts = params.split('|');
    if (parts.length < 2) return "❌ פורמט שגוי. השתמש: מספר|שם מקצוע";
    
    const [optionNumber, ...subjectParts] = parts;
    const subject = subjectParts.join('|');

    if (!menus.teacher_highschool_input.options) {
        menus.teacher_highschool_input.options = {};
    }

    menus.teacher_highschool_input.options[optionNumber] = {
        text: subject,
        subject: subject
    };

    updateHighSchoolMenuMessage(menus);
    return saveJSONFile("menus.json", menus)
        ? `✅ נוספה אפשרות ${optionNumber}: ${subject}`
        : "❌ שגיאה בשמירה";
}

function removeHighSchoolSubject(optionNumber, menus) {
    if (!menus.teacher_highschool_input.options[optionNumber]) {
        return `❌ אפשרות ${optionNumber} לא קיימת`;
    }

    const removedSubject = menus.teacher_highschool_input.options[optionNumber].text;
    delete menus.teacher_highschool_input.options[optionNumber];
    updateHighSchoolMenuMessage(menus);
    
    return saveJSONFile("menus.json", menus)
        ? `✅ הוסרה אפשרות ${optionNumber}: ${removedSubject}`
        : "❌ שגיאה בשמירה";
}

function updateHighSchoolMenuMessage(menus) {
    let message = "אנא בחרו מהאפשרויות הבאות:\n\n";
    Object.keys(menus.teacher_highschool_input.options)
        .sort((a,b) => a - b)
        .forEach(num => {
            message += `${num}. ${menus.teacher_highschool_input.options[num].text}\n`;
        });
    message += "\nאנא השיבו עם המספר של בחירתכם, 'חזור' או '0'";
    menus.teacher_highschool_input.message = message;
}

function listHighSchoolSubjects(menus) {
    return Object.keys(menus.teacher_highschool_input.options)
        .map(num => `${num}. ${menus.teacher_highschool_input.options[num].text}`)
        .join('\n') || "❌ אין אפשרויות מוגדרות";
}
function addMenuOptionToMenu(menuName, optionNumber, text, value, menus) {
    try {
        if (!menus[menuName]) {
            return `❌ תפריט '${menuName}' לא קיים.`;
        }
        if (menus[menuName].options[optionNumber]) {
            return `❌ אפשרות ${optionNumber} כבר קיימת בתפריט '${menuName}'. השתמש ב-/admin_update_menu_option לעדכון.`;
        }

        const newOption = { text: text };
        if (value.startsWith("nextMenu:")) {
            newOption.nextMenu = value.substring("nextMenu:".length).trim();
        } else {
            newOption.response = value;
        }

        menus[menuName].options[optionNumber] = newOption;

        if (saveJSONFile("menus.json", menus)) {
            return `✅ אפשרות ${optionNumber} נוספה בהצלחה לתפריט '${menuName}'.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in addMenuOptionToMenu:", error);
        return "❌ שגיאה בהוספת אפשרות לתפריט.";
    }
}

function updateMenuOptionInMenu(menuName, optionNumber, newText, newValue, menus) {
    try {
        if (!menus[menuName]) {
            return `❌ תפריט '${menuName}' לא קיים.`;
        }
        if (!menus[menuName].options[optionNumber]) {
            return `❌ אפשרות ${optionNumber} לא קיימת בתפריט '${menuName}'. השתמש ב-/admin_add_menu_option להוספה.`;
        }

        menus[menuName].options[optionNumber].text = newText;
        if (newValue.startsWith("nextMenu:")) {
            menus[menuName].options[optionNumber].nextMenu = newValue.substring("nextMenu:".length).trim();
            delete menus[menuName].options[optionNumber].response; // Remove response if it was a nextMenu
        } else {
            menus[menuName].options[optionNumber].response = newValue;
            delete menus[menuName].options[optionNumber].nextMenu; // Remove nextMenu if it was a response
        }

        if (saveJSONFile("menus.json", menus)) {
            return `✅ אפשרות ${optionNumber} בתפריט '${menuName}' עודכנה בהצלחה.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in updateMenuOptionInMenu:", error);
        return "❌ שגיאה בעדכון אפשרות התפריט.";
    }
}

function removeMenuOptionFromMenu(menuName, optionNumber, menus) {
    try {
        if (!menus[menuName]) {
            return `❌ תפריט '${menuName}' לא קיים.`;
        }
        if (!menus[menuName].options[optionNumber]) {
            return `❌ אפשרות ${optionNumber} לא קיימת בתפריט '${menuName}'.`;
        }

        delete menus[menuName].options[optionNumber];

        // If this is the FAQ menu, update the message after removal
        if (menuName === 'faq_menu') {
            updateFAQMenuMessage(menus);
        }

        if (saveJSONFile("menus.json", menus)) {
            return `✅ אפשרות ${optionNumber} נמחקה בהצלחה מהתפריט '${menuName}'.`;
        }
        return "❌ שגיאה בשמירת השינויים.";
    } catch (error) {
        console.error("Error in removeMenuOptionFromMenu:", error);
        return "❌ שגיאה במחיקת אפשרות התפריט.";
    }
}
// Specialized function for adding options to FAQ menu with automatic numbering and message update
function addFAQOption(questionText, answerText, menus) {
    try {
        const menuName = 'faq_menu';
        
        if (!menus[menuName]) {
            return `❌ תפריט '${menuName}' לא קיים.`;
        }

        // Ensure options object exists
        if (!menus[menuName].options) {
            menus[menuName].options = {};
        }

        // Find the next available option number (sequential)
        const existingOptions = menus[menuName].options || {};
        const existingNumbers = Object.keys(existingOptions)
            .map(key => parseInt(key))
            .filter(num => !isNaN(num))
            .sort((a, b) => a - b);
        
        let nextNumber = 1;
        // Find the first gap or add to the end
        for (let i = 0; i < existingNumbers.length; i++) {
            if (existingNumbers[i] !== nextNumber) {
                break;
            }
            nextNumber++;
        }
        
        // Add the new option
        menus[menuName].options[nextNumber.toString()] = {
            text: questionText,
            response: answerText
        };
        
        // Update the menu message to include the new option
        updateFAQMenuMessage(menus);
        
        if (saveJSONFile("menus.json", menus)) {
            return `✅ שאלה ${nextNumber} נוספה בהצלחה לתפריט FAQ: "${questionText}"`;
        }
        
        return "❌ שגיאה בשמירת האפשרות החדשה.";
    } catch (error) {
        console.error("Error in addFAQOption:", error);
        return "❌ שגיאה בהוספת שאלה לתפריט FAQ.";
    }
}
// Helper function to update the FAQ menu message
function updateFAQMenuMessage(menus) {
    try {
        const menuName = 'faq_menu';
        if (!menus[menuName]) return;
        
        const options = menus[menuName].options || {};
        const sortedKeys = Object.keys(options)
            .map(key => parseInt(key))
            .filter(num => !isNaN(num))
            .sort((a, b) => a - b);
        
        // Build message with proper single newlines
        let message = "*❓ שאלות נפוצות (FAQ)*\n\n";
        message += "בחרו שאלה מהרשימה:\n\n";
        
        // Add each option to the message
        sortedKeys.forEach(optionNum => {
            const option = options[optionNum.toString()];
            if (option && option.text) {
                message += `${optionNum}. ${option.text}\n`;
            }
        });
        
        // Add footer instructions with proper line breaks
        message += "\nאנא השיבו עם המספר של השאלה, 'חזור' או '0'\n\n";
        message += "'חזור' - חזרה לתפריט הקודם\n";
        message += "'0' - חזרה מהירה לתפריט הראשי\n\n";
        message += "שימו לב, ייתכן ויקח כמה שניות לטעינת ההודעה מכיוון שהיא מכילה קישור";
        
        menus[menuName].message = message;
        
        console.log("FAQ menu message updated successfully");
    } catch (error) {
        console.error("Error in updateFAQMenuMessage:", error);
    }
}
function isValidGroup(chat) {
  try {
    // Multiple ways to detect if chat is a group
    if (chat.isGroup === true) return true;
    if (chat.id && chat.id._serialized && chat.id._serialized.endsWith('@g.us')) return true;
    if (chat.groupMetadata) return true;
    return false;
  } catch (e) {
    return false;
  }
}

async function performHealthCheck(client) {
  try {
    const testChats = await client.getChats();
    const testGroups = testChats.filter(isValidGroup);
    console.log(`Health check: Found ${testGroups.length} groups`);
    return testGroups.length > 0;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}
module.exports = {
    isMessageBeingProcessed,
    isUserOnCooldown,
    isAdmin,
    saveJSONFile,
    reloadData,
    isUserInGroup,
    getGroupParticipants,
    getParticipantsForGroup,
    scanGroupMembers,
    broadcastMessage,
    resolveLidToPhone,
    addToBlacklist,
    removeFromBlacklist,
    listBlacklist,
    addTeacher,
    updateTeacher,
    removeTeacher,
    listTeachers,
    addMenu,
    updateMenu,
    deleteMenu,
    addMenuOption,
    updateMenuOption,
    removeMenuOption,
    listMenuOptions,
    updateMainMenuMessage,
    updateMenuMessage,
    listMenus,
    addCourseLink,
    updateCourseLink,
    removeCourseLink,
    listCourseLinks,
    addGeneralLink,
    updateGeneralLink,
    removeGeneralLink,
    listGeneralLinks,
    addGroup,
    updateGroup,
    removeGroup,
    listGroups,
    approveGroupRequests,
    updateUserInteraction,
    createMenu,
    addHighSchoolSubject,
    removeHighSchoolSubject,
    listHighSchoolSubjects,
    updateMenuOptionInMenu,
    removeMenuOptionFromMenu,
    addMenuOptionToMenu,
    updateFAQMenuMessage,
    addFAQOption,
    isValidGroup,
    performHealthCheck
};
