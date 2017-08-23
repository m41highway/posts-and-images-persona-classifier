const FB = require('fb')
const fetch = require('node-fetch')
const Promise = require('bluebird');

FB.options({version: 'v2.7'})

// ----------------------
// Helper function
// ----------------------
function getTestUser (targetId) {
  return function (testUser) {
    if (testUser.id === targetId) {
        console.log('found user ' + targetId);
      return testUser
    }
  }
}

exports.getPosts = function (appId, appToken, fbUserId) {
    return new Promise(function (resolve, reject){
        let facebookAppUrl = `https://graph.facebook.com/${appId}/accounts/test-users?access_token=${appToken}`;
        fetch(facebookAppUrl)

        .then(function (res) {
            return res.json()
        })

        .then(function (users) {
            let user = users.data.find(getTestUser(fbUserId))
            console.log('The user is : ', user);
            return new Promise((resolve, reject) => {
                FB.api('me', { access_token: user.access_token }, function (res){
                    console.log('This is me ',res);
                    resolve(res);
                })
//                 FB.api('me/posts', { access_token: user.access_token }, function (res){
// console.log(res);
//                     let posts = res.data.map(function (post) {
//                         if (post.message) {
//                             return post.message
//                         }
//                     }).filter(function (post) {
//                         return post !== undefined
//                     })
//                     let text = posts.join(',')
//                     resolve(text);
//                 })
            })
        })

        .then(function (res) {
            resolve(res);
        })
    })
}
