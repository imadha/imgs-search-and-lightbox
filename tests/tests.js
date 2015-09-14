/**
 * Imgs App Tests
 * @author Ibrahim Madha
 *
 * Primitive assertions to run in browser
 */

var output = document.getElementById('test-output');
var frame = document.getElementById('test-frame').contentWindow;

var failCount = 0;
var passCount = 0;
var totalCount = 0;

/**
 * Tests if condition is true or false
 * Writes to document if pass or fail
 * Use this instead of console.assert for DOM output
 * @param {boolean expression} condition - the condition being tested
 * @param {string} description - description of assertion, to be used in messaging
 */
function assert (condition, description) {
  var result;

  if (condition) {
    passCount++;
    result = 'pass';
  }  else {
    failCount++;
    result = 'fail';
  }
  totalCount++;

  var p = document.createElement('p');
  p.className = result;
  p.textContent = description;
  output.appendChild(p);
}

/**
 * Writes asimple  log message to DOM
 * @param {string} message
 */
function log (message) {
  var p = document.createElement('p');
  p.textContent = message;
  output.appendChild(p);
}

/**
 * Runs all tests
 */
function runTests () {
  // flush test output
  output.innerHTML = '';

  log('Starting tests...');
  
  // test frame exists
  assert(typeof frame !== 'undefined', 'Testing Iframe exists');
  
  // test app exists
  var app = frame.imgsApp;
  assert(app instanceof frame.App, 'imgsApp instance of App');

  // test ui updates
  app.updateState({ test: 'foobar' });
  assert(app.state.test === 'foobar', 'updateState updates app.state')
  assert(frame.document.body.getAttribute('data-state-test') === 'foobar', 'updateState updates data-state attributes');

  app.updateMessage('this is a test');
  assert(frame.document.getElementsByClassName('messaging')[0].textContent === '(this is a test)', 'updateMessage updates messaging')

  // test hastag sanitization
  var hashtagTests = [
    {
      input: 'test',
      expected: 'test'
    },
    {
      input: 'TeST',
      expected: 'test',
    },
    {
      input: 't est',
      expected: 't_est'
    },
    {
      input: 'te$t',
      expected: 'tet'
    },
    {
      input: 'téśt',
      expected: 'téśt'
    },
    {
      input: '💩',
      expected: '💩'
    }
  ];
  var input, expected;
  for (var i = 0, len = hashtagTests.length; i < len; i++) {
    input = hashtagTests[i].input;
    expected = hashtagTests[i].expected;
    assert(app.getSanitizedHashtag(input) === expected, 'getSanitizedHashtag changes ' + input + ' to ' + expected);
  }

  // test script injection works
  app.injectJSONP('tests/blank.js');
  var scripts = frame.document.getElementsByTagName('script')
  assert(scripts[scripts.length - 1].getAttribute('src') === 'tests/blank.js', 'injectJSONP injects script');

  // test if request works
  log('Testing request and request callback with timeout of 5 seconds...')
  app.requestPhotos('test');
  setTimeout(function () {
    assert(app.state.hashtag === 'test', 'requestPhotos updates hashtag state');
    assert(frame.document.getElementsByClassName('thumb').length === 20, 'requestPhotos recieved 20 results');
    assert(frame.document.body.getAttribute('data-state-view') === 'results', 'renderResults updates view');
    assert(app.photoStore.length === 20, 'renderResults stores 20 results');
    completeTests();  
  }, 5000);
}

/**
 * Logs completion and fail count
 * called after waiting for request to complete
 */
function completeTests () {
  log('Tests complete.');
  log(failCount + ' out of ' + totalCount + ' tests failed.');
}