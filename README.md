# IMGS
## hashtag search and photo lightbox, powered by instagram

viewable demo at http://ibrahim.madha.net/demos/imgs/

Tested in Google Chrome 45, Firefox 40, Safari 8, Mobile Safari 8 and IE11

### How to run ###
IMGS is pure HTML+CSS+JS. All you need is a web server that can serve static files and understand relative paths.  Navigate to index.html in your browser and you should be good to go.

### Testing ###
You may run the demo's very primitive unit tests at http://ibrahim.madha.net/demos/imgs/tests/, or visit tests/index.html on whichever server you have copied the code.

### Things to try in IMGS ###
 1. Try typing caps or spaces in the search input
 2. Try typing symbols or characters that don't work in hashtags
 3. Try submitting an empty search string
 4. Click around hashtag results and cycle through photos in the lightbox
 5. Navigate to other hashtags from photo captions
 6. Give me money to do this kind of stuff 😉💰

### Future Considerations ###
In an ideal world, our code would have all the features. Here are somethings I might do:
- Modularize JS+CSS into web component style chunks and bundle assets with some sort of grunt/gulp/webpack build script.
- Type to search.  Instagram rate limits API calls so this was out of scope for this project for now.
- Real unit tests. Although these work, there could be much more thorough testing for all the use cases.

### Usage ###
Feel free to use this code or adapt any part of it in your own work!
