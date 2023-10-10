import { _ } from 'meteor/underscore'

var KEEPALIVE_TIMEOUT_SECONDS = 15;
// Collections //////////////////////////////////////////////////////////////////////////////////////////
AppSettings = new Meteor.Collection("appsettings");
Chats = new Meteor.Collection("chats");
UserIcons = new Meteor.Collection("usericons");
UserStatus = new Meteor.Collection("userstatus");

Meteor.publish("allChats", function() {
	return Chats.find({}, { fields: {timestamp: 1, message: 1, userIconClassName: 1 } } );
});

Meteor.publish("allAppSettings", function() {
	return AppSettings.find();
});

Meteor.publish("userIcon", function(userGuid) {
	if (!userGuid) return null;
	if (UserIcons.find( { usedByUserGuid: userGuid }).count() === 0) {
		selectIconForUser(userGuid);
	}
	return UserIcons.find( { usedByUserGuid: userGuid }, { fields: { className: 1 }});
});

UserStatus.find().observe({
	removed : function(removedDocument) {
		unselectUserIcon(removedDocument.userGuid);
	}
});

// Methods /////////////////////////////////////////////////////////////////////////////////////////////////

Meteor.methods({
	insertChat : function(chatMessage) {
		var totalNumberOfChats = Chats.find().count();
		if (totalNumberOfChats >= 50) {
			var oldestChatMessage = Chats.findOne({}, { sort: { timestamp: 1}});
			Chats.remove({_id: oldestChatMessage._id});
		}

		var icon = UserIcons.findOne({usedByUserGuid: chatMessage.userGuid });
		if (!icon) {
			selectIconForUser(chatMessage.userGuid, function(className) {
				doInsert(new Date(), chatMessage.message, className);
			});
		} else {
			UserIcons.update({ _id: icon._id }, {$set: { lastUsedDateTime: new Date()} });
			doInsert(new Date(), chatMessage.message, icon.className);
		}

		function doInsert(timestamp, message, className) {
			Chats.insert({ timestamp: timestamp, message: message, userIconClassName: className });
		}

	},
	rerollUserIcon : function(userGuid) {
		unselectUserIcon(userGuid, function() {
			selectIconForUser(userGuid);
		});
	},
	keepAlive: function(userGuid) {
		UserStatus.upsert({ userGuid: userGuid }, { $set: { keepAliveDateTime: new Date() }} );
		AppSettings.upsert( { name: 'usersCurrentlyOnline' }, { $set: { value: UserStatus.find().count() }});
	}
});

// Functions ///////////////////////////////////////////////////////////////////////////////////////////////

function selectIconForUser(userGuid, callback) {
	var unusedIcons = UserIcons.find({ usedByUserGuid: null }).fetch();
	if (unusedIcons.length === 0) {
		Meteor._debug("ran out of icons");
		throw "Ran out of icons!";
	}
	var selectedIcon = _.sample(unusedIcons);
	UserIcons.update({ _id: selectedIcon._id }, { $set: { usedByUserGuid: userGuid, lastUsedDateTime: new Date() } }, {}, function() {
		if (typeof callback === "function") {
			callback(selectedIcon.className);
		}
	});
}

function unselectUserIcon(userGuid, callback) {
	if (!userGuid) {
		Meteor._debug("userGuid has to be set for unselectUserIcon");
		throw "userGuid has to be set for unselectUserIcon";
	}

	UserIcons.update({ usedByUserGuid: userGuid }, { $set: { usedByUserGuid: null } }, { multi: true }, function() {
		if (typeof callback === 'function') {
			callback();
		}
	});
}

function initializeUserIconsDatabase() {
	if (UserIcons.find().count() === 0) {

		var animals = ["specials", "bat", "bear", "beaver", "butterfly", "cat", "chicken", "cow", "crow", "deer", "dog", "donkey", "dragon", "duck", "elephant", "frog", "giraffe", "killerwhale", "kiwi", "ladybug", "lion", "lobster", "moose", "mouse", "narwhale", "octopus", "pig", "rabbit", "shark", "turtle", "sheep", "sloth", "squirrel", "unicorn"];
		// var animals = ["dragon", "bear"]

		var colors = ["white", "red", "orange", "yellow", "green", "blue", "purple", "pink"];
		// var colors = ["white", "red"];

		for (var a in animals) {
			for (var c in colors) {
				UserIcons.insert({ className: animals[a] + "-" + colors[c], usedByUserGuid: null, lastUsedDateTime: new Date(1900,0,1) });
			}
		}

	}
}

// Startup ////////////////////////////////////////////////////////////////////////////////////////////////////////
Meteor.startup(function() {

	AppSettings.upsert( { name: 'usersCurrentlyOnline' }, { $set: { value: UserStatus.find().count() }});

	if (!AppSettings.findOne({ name: "lastestImageUrl" })) {
		AppSettings.insert( { name: "lastestImageUrl", value: "/img/default.png" } );
	}

	initializeUserIconsDatabase();

	Meteor.setInterval(function() {
		var twelveHoursAgo = new Date().addHours(-12);
		UserIcons.update( { lastUsedDateTime: { $lt: twelveHoursAgo } } , { $set: { usedByUserGuid: null } } , {multi: true} );
	}, 60000);

	Meteor.setInterval(function() {
		var minKeepAliveDateTime = new Date().addSeconds(-1 * KEEPALIVE_TIMEOUT_SECONDS);
		UserStatus.remove( { keepAliveDateTime: { $lt: minKeepAliveDateTime } });
		AppSettings.upsert( { name: 'usersCurrentlyOnline' }, { $set: { value: UserStatus.find().count() }});
	}, 15000);

});