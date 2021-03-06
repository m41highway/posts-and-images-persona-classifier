const Promise = require('bluebird');
const co = require('co');
const fbTestUser = require('./lib/FacebookTestUsers');
const config = require('./config');
const findHashtags = require('find-hashtags');
const natural = require('natural');
const TfIdf = natural.TfIdf;
const tfidf = new TfIdf();
const getLoaderPromoise = require('./lib/knowledge-loader').getLoaderPromoise;

// ---------------------------------
// Get testing data
// ---------------------------------
const users = require('./test').data;


function run () {
    // ---------------------------------------
    // 1. Load classifier
    // 2. Populate the user's posts
    // 3. Add document to the TFIDF
    // ---------------------------------------
    return Promise.coroutine(function* (){

        // ---------------------------------------
        // Store the user's posts in memory
        // ---------------------------------------
        let userPostList = []


        // --------------------------------------
        // Step 1
        // Load the promisfied persona classifier
        // to the global refernce
        // --------------------------------------
        const classifier = yield getLoaderPromoise;


        // ------------------------
        // Step 2 and 3
        // ------------------------
        yield Promise.each(users, co.wrap(function* (u) {
            console.log(`Processing ${u.facebook_account} ...`);
            let posts = yield fbTestUser.getPosts(config.facebook.appId, config.facebook.appToken, u.facebook_account)
            userPostList.push({
                'idx': u.idx,
                'userId': u.facebook_account,
                'posts': posts,
                'justification': u.justification
            })
            tfidf.addDocument(posts ? posts : '');
        }));

        // --------------------------------------------------------------------
        // Find out a list a words to represent the Facebook user
        // by concatenating the:
        // 1. important keywords based on statistics (TF/IDF)
        // 2. hashtags created by the user
        // --------------------------------------------------------------------
        let prettyResult = [];

        yield Promise.each(userPostList, co.wrap(function* (u){
            let allWords = tfidf.listTerms(u.idx);
            let importantWords= allWords.slice(0, Math.round(config.facebook.threshold * allWords.length));
            let keywords = importantWords.map(function (w) { return w.term }).join(' ') + findHashtags(u.posts).join(' ');

            if (keywords) {
                let prediction = classifier.getClassifications(keywords);
                // -------------------------------------
                // Format the predictions
                // -------------------------------------
                let sum = prediction.reduce(function(acc, score) {
                    return acc + score.value;
                }, 0);
                let scoreList = [];
                yield Promise.each(prediction, co.wrap(function*(category) {
                    let s = category.value.toPrecision(10);
                    let t = sum.toPrecision(10);
                    let x = s / t * 100;
                    scoreList.push({'label': category.label, 'percent': Math.round(x)});
                }));

                // -------------------------------------
                // Sort score in descending order
                // -------------------------------------
                scoreList.sort(function (a, b){
                    return b.percent - a.percent;
                })

                prettyResult.push({
                    'facebook_account': u.userId,
                    'justification': u.justification,
                    'scores': scoreList,
                    'keywords': keywords,
                    'prediction': scoreList[0].label
                })
            }
        }));

        return prettyResult;
    })();
}

let measurement = run()

measurement
.then(r => {
    let correctCount = 0;
    let wrongCount = 0;
    let isCorrect = false;
    r.forEach((t) => {
        if (t.justification === t.prediction) {
            isCorrect = true;
            correctCount++;
        } else {
            isCorrect = false;
            wrongCount++;
        }
        console.log(`${t.facebook_account} ${t.justification} (jt) VS ${t.prediction} (pd) ${(isCorrect === true) ? 'Correct': 'Wrong'}`);
        console.log('Keywords:', t.keywords);
        t.scores.forEach( s => {
            console.log(`${s.label} -> ${s.percent}%`);
        })
        // console.log(t.scores);
        console.log('---------------------------------------------------------------------------------------');

    })
    console.log('Correct count=' + correctCount);
    console.log('Wrong count=' + wrongCount);
    console.log('Accuracy=' + Math.round(correctCount / (correctCount + wrongCount) * 100) + '%');
})
