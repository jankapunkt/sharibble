var IMAGE_URL_REGEX = /https?:\/\/\S+\.(jpe?g|gif|png)/ig;
var DEFAULT_IMAGE_URL = "/img/default.png";
var KEEPALIVE_INTERVAL_MILLISECONDS = 7000;
import { Random } from 'meteor/random'
Session.set("userGuid", Random.id())

// Startup ///////////////////////////////////////////////////////////////////////////////////////////////
Meteor.startup(function() {
    Meteor.call("keepAlive", Session.get("userGuid"));
    Meteor.setInterval(function() {
        Meteor.call("keepAlive", Session.get("userGuid"));
    }, KEEPALIVE_INTERVAL_MILLISECONDS);
});

// Collections ///////////////////////////////////////////////////////////////////////////////////
AppSettings = new Meteor.Collection("appsettings");
Chats = new Meteor.Collection("chats");
UserIcon = new Meteor.Collection("usericons");
UserStatus = new Meteor.Collection("userstatus");


Meteor.subscribe("allAppSettings");
/*
AppSettings.find().observe({
  changed: function(oldDoc, newDoc) {
    if (newDoc.numberOfActiveUser) {
      Session.set("")
    }
  }
});
*/

Meteor.subscribe("allChats", {
    onReady: function() {
        scrollToBottom();
    }
});

Meteor.subscribe("userIcon", Session.get("userGuid"));

Chats.find().observe({
    added: function() {
        // Meteor._debug("inside chats.find().observer added, atBottomOfChatWindow: " + isAtBottomOfChatWindow());
        Session.set("atBottomOfChatWindow", isAtBottomOfChatWindow());
    }
});

// UserIcon.find().observeChanges({
// added: function(id, fields) {
// var currentUserIcon = UserIcon.findOne( { usedByUserGuid: Session.get("userGuid") } );
// if (currentUserIcon) {
//   Session.set("currentUserIconClassName", currentUserIcon.className)
// }
// },
// changed: function(id, fields) {
//   console.log("usericon changed id: " + id + " fields: " + JSON.stringify(fields));
// },
// removed: function(id) {
// Session.set("currentUserIconClassName", "");
// }

// });

// Helper Functions - must be first for some reason ///////////////////////////////////////////////

UI.registerHelper("formatTimestamp", function(isoDateTime) {
    //return isoDateTime;
    var d = new Date(isoDateTime);
    var hh = d.getHours();
    var m = d.getMinutes();
    var dd = "AM";
    var h = hh;
    if (h >= 12) {
        h = hh - 12;
        dd = "PM";
    }
    if (h == 0) {
        h = 12;
    }
    m = m < 10 ? "0" + m : m;

    return h + ":" + m + " " + dd;
});

UI.registerHelper("embedUrl", function(text) {
    var matches = text.match(IMAGE_URL_REGEX);
    for (var m in matches) {
        text = surroundWithAnchor(text, matches[m]);
    }
    return text;
});

// Templates ////////////////////////////////////////////////////////////////////////////////////////
Template.chats.chats = function() {
    return Chats.find({}, {
        sort: {
            timestamp: 1
        }
    });
}
Template.chatmessage.rendered = function() {
    if (Session.get("atBottomOfChatWindow")) {
        scrollToBottom();
    }
}
Template.image.url = function() {
    var url = AppSettings.findOne({
        name: "lastestImageUrl"
    });
    return url ? url.value : DEFAULT_IMAGE_URL;
}
Template.infobar.currentUserIconClassName = function() {
    var userIcon = UserIcon.find().fetch();
    // console.log("userIcon", userIcon);
    return userIcon.length > 0 ? userIcon[0].className : "";
}
Template.infobar.usersCurrentlyOnline = function() {
    var usersCurrentlyOnline = AppSettings.findOne({
        name: 'usersCurrentlyOnline'
    });
    return usersCurrentlyOnline ? usersCurrentlyOnline.value : "?";
}

// Template events //////////////////////////////////////////////////////////////////////////////////////
Template.chatinput.events({
    'keydown textarea#write': function(event) {
        if (event.which == 13) {
            var write = $(event.currentTarget);
            var message = write.val();
            if (message != '') {
                scrollToBottom();
                processNewChatMessage(message);
                write.val('');
            }
            event.preventDefault();
        }
    }
});

Template.chatsubmit.events({
    'click input#send': function(event) {
        scrollToBottom();
        var write = $(event.currentTarget).closest("form").find('#write');
        var message = write.val();
        if (message != '') {
            processNewChatMessage(message);
            write.val('')
        }
        event.preventDefault();
    }
});

Template.infobar.events({
    'click #reroll': function(event) {
        Meteor.call("rerollUserIcon", Session.get("userGuid"));
    }
});


// Functions ///////////////////////////////////////////////////////////////////////////////////////

function isAtBottomOfChatWindow() {
    var chatlog = $('#chatlog');
    var heightOfChatlog = chatlog.height();
    var heightOfChatContent = chatlog[0].scrollHeight;
    var topOfChatContent = chatlog[0].scrollTop;
    return (heightOfChatContent - heightOfChatlog <= topOfChatContent)
}

function scrollToBottom() {
    $(function() {
        $('#chatlog')[0].scrollTop = $('#chatlog')[0].scrollHeight;
    });
}


function processNewChatMessage(message) {
    Meteor.call("insertChat", {
        message: message,
        userGuid: Session.get("userGuid")
    });
debugger
    var imageUrl = findImageUrl(message);
    if (imageUrl) {
        var lastestImageUrl = AppSettings.findOne({
            name: "lastestImageUrl"
        });
        AppSettings.update({
            _id: lastestImageUrl._id
        }, {
            name: "lastestImageUrl",
            value: imageUrl
        });
    }
}

function surroundWithAnchor(text, url) {
    var domain = extractDomain(url);
    domain = domain ? domain.capitalizeFirstLetter() + " " : "";
    return text.replace(url, '<a href="' + url + '" target="_blank">' + domain + 'Image</a>');
}

function extractDomain(url) {
    var domainNameRegEx = /(?:https?:\/\/\S+\.)(\S+)(?:\.(?:com?|org|net|mil|edu|ca|li|us))/ig;
    var domain = domainNameRegEx.exec(url);
    return domain ? domain[1] : null;
}

function findImageUrl(text) {
    var matches = text.match(IMAGE_URL_REGEX);

    if (matches) {
        return matches[0];
    } else {
        return null;
    }
}
