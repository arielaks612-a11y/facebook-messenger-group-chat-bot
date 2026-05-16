const login = require("facebook-chat-api");
const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const { downloadImageFromUnsplash } = require("./getImageUnsplash");

const credential = { appState: JSON.parse(fs.readFileSync('appstate.json', 'utf-8')) };
const prefix = "😘"; // Customize the prefix as desired

// Create a bot instance
login(credential, (err, api) => {
  if (err) {
    console.error(err);
    return;
  }

  // Successful login
  console.log("Bot logged in!");

  // Listen for incoming messages
  api.listenMqtt((err, message) => {
    if (err) {
      console.error(err);
      return;
    }

    // Process the incoming message
    handleMessage(api, message);
  });
});

// Handle incoming messages
function handleMessage(api, message) {
  if (message.body) {
    const senderId = message.senderID;
    const body = message.body;
    const threadId = message.threadID;

    console.log(`Received message: "${body}" from ${senderId}`);

    // Check if the message starts with the prefix
    if (body.startsWith(prefix)) {
      // Extract the command and arguments from the message
      const [command, ...args] = body.slice(prefix.length).split(" ");

      // Handle different commands
      switch (command.toLowerCase()) {
        case "hi":
          api.sendMessage({
            body: 'Hello @Buddy . I am a simple Facebook Group Chat Bot. !help to learn more! :D <3',
            mentions: [{
                 tag: '@Buddy',
                 id: message.senderID,
                 fromIndex: 6, // Highlight the second occurrence of @Sender
            }],
        }, message.threadID);
          break;
        case "help":
          sendHelpMessage(api, threadId);
          break;
        case "help-game":
          sendGameHelpMessage(api, threadId);
        break;
        case "echo":
          sendEchoMessage(api, threadId, args.join(" "));
          break;
        case "add":
          if (args.length === 1) {
            const memberId = args[0];
            addUserToGroup(api, memberId, threadId);
          } else {
            sendErrorMessage(api, threadId, "Invalid command. Usage: !add <memberId>");
          }
          break;
        case "img":
          if (args.length === 1) {
            const imageName = args[0];
            sendImageFromGoogle(api, threadId, imageName);
          } else {
            sendErrorMessage(api, threadId, "Invalid command. Usage: !img <imageName>");
          }
          break;
        default:
          sendErrorMessage(api, threadId, "Unknown command. Type !help for available commands.");
          break;
          case "imgu":
            if (args.length === 1) {
              const imageName = args[0];
              sendImageFromUnsplash(api, threadId, imageName);
            } else {
              sendErrorMessage(api, threadId, "Invalid command. Usage: !imgu <imageName>");
            }
          break;
          // Handle the !game command and start the game
          case "game":
            if (gameActive) {
              sendErrorMessage(api, threadId, "A game is already in progress. Please wait for it to finish.");
            } else {
              sendAnimeCharacterImage(api, threadId);
            }
            break;
            // Process the player's answer
            case "ans":
              if (gameActive) {
                const guessedAnswer = args.join(" ").trim();
                processAnswer(api, threadId, guessedAnswer);
              } else {
                sendErrorMessage(api, threadId, "Game is not running. Use !game to start a new game.");
              }
              break;     
      }
    }
  }
}

// Send a message to the specified thread
function sendMessage(api, threadId, message) {
  api.sendMessage(message, threadId, (err) => {
    if (err) {
      console.error(err);
      return;
    }

    console.log(`Sent message: "${message}" to thread ${threadId}`);
  });
}

// Send a help message with available commands
function sendHelpMessage(api, threadId) {
  const helpMessage =
    "Facebook Group Chat Bot\n" +
    "Version: 1.3 (Beta)\n\n" +
    "Available commands:\n" +
    `${prefix}hi: Say hello to the bot\n` +
    `${prefix}help: Show this help message\n` +
    `${prefix}echo <message>: Echo back a message\n` +
    `${prefix}add <memberId>: Add a member to the group\n` +
    `${prefix}img <imageName>: Get image from Google (low quality, quick, unlimited)\n` +
    `${prefix}imgu <subject>: Get image from Unsplash (High quality, slow, limited)\n`+
    `${prefix}help-game: Play game with this bot`;

  sendMessage(api, threadId, helpMessage);
}

//Send a game help message with availabale commands

function sendGameHelpMessage(api, threadId) {
  const helpMessage = `
  Welcome to the Anime Guessing Game!
    
  This bot allows you to play a guessing game where you have to guess the name of an anime character.
    
  Commands:
  ${prefix}game: Start a new game.
  ${prefix}ans <your answer>: Submit your answer to the current anime character.
  ${prefix}help-game: Show this help message.
    
  How to play:
  1. Use the command ${prefix}game to start a new game.
  2. The bot will send an image of an anime character.
  3. You have to guess the name of the character and send your answer using the ${prefix}ans command followed by your answer.
  4. If your answer is correct, you'll receive a congratulatory message.
  5. If your answer is wrong, you can try again.
    
  Have fun playing the Anime Guessing Game!
  `;
  
  sendMessage(api, threadId, helpMessage);
}



// Echo back a message
function sendEchoMessage(api, threadId, message) {
  sendMessage(api, threadId, `You said: "${message}"`);
}

// Send an error message to the specified thread
function sendErrorMessage(api, threadId, errorMessage) {
  sendMessage(api, threadId, errorMessage);
}

// Add a member to the group
function addUserToGroup(api, memberId, threadId) {
  api.addUserToGroup(memberId, threadId, (err) => {
    if (err) {
      console.error(err);
      sendErrorMessage(api, threadId, "Failed to add member to the group.");
      return;
    }

    sendMessage(api, threadId, "Member added to the group successfully.");
  });
}

// Send an image related to the provided name from Google
function sendImageFromGoogle(api, threadId, imageName) {
  const searchQuery = encodeURIComponent(imageName);
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${searchQuery}`;

  axios.get(searchUrl)
    .then(response => {
      const $ = cheerio.load(response.data);
      const imageLinks = [];

      // Extract the image links from the search results
      $('img').each((index, element) => {
        const imageLink = $(element).attr('src');
        if (imageLink && !imageLink.endsWith('.gif')) { // Exclude GIF images
          imageLinks.push(imageLink);
        }
      });

      if (imageLinks.length > 0) {
        // Randomly select an image link
        const randomIndex = Math.floor(Math.random() * imageLinks.length);
        const imageUrl = imageLinks[randomIndex];

        // Download the image
        axios({
          url: imageUrl,
          responseType: 'stream'
        }).then(response => {
          const imagePath = `C:/Users/Sabit Bro/Desktop/facebook-chat-api-master/pictures/${imageName}.jpg`;

          // Save the image to the specified directory
          response.data.pipe(fs.createWriteStream(imagePath))
            .on('finish', () => {
              // Send the image to the chat
              api.sendMessage({
                body: `Here is an image of ${imageName}`,
                attachment: fs.createReadStream(imagePath)
              }, threadId, (err) => {
                if (err) {
                  console.error(err);
                  return;
                }

                console.log(`Sent image attachment '${imageName}' to thread ${threadId}`);

                // Delete the image file after sending
                fs.unlink(imagePath, (err) => {
                  if (err) {
                    console.error(err);
                    return;
                  }

                  console.log(`Deleted image file '${imagePath}'`);
                });
              });
            })
            .on('error', (err) => {
              console.error(err);
              sendErrorMessage(api, threadId, 'Failed to download the image.');
            });
        });
      } else {
        sendErrorMessage(api, threadId, 'No image found for the provided name.');
      }
    })
    .catch(error => {
      console.error(error);
      sendErrorMessage(api, threadId, 'Failed to fetch image from Google.');
    });
}



// anime image finder with google
function sendAnimeFromGoogle(api, threadId, imageName) {
  const searchQuery = encodeURIComponent(imageName);
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${searchQuery}`;

  axios.get(searchUrl)
    .then(response => {
      const $ = cheerio.load(response.data);
      const imageLinks = [];

      // Extract the image links from the search results
      $('img').each((index, element) => {
        const imageLink = $(element).attr('src');
        if (imageLink && !imageLink.endsWith('.gif')) { // Exclude GIF images
          imageLinks.push(imageLink);
        }
      });

      if (imageLinks.length > 0) {
        // Randomly select an image link
        const randomIndex = Math.floor(Math.random() * imageLinks.length);
        const imageUrl = imageLinks[randomIndex];

        // Download the image
        axios({
          url: imageUrl,
          responseType: 'stream'
        }).then(response => {
          const imagePath = `C:/Users/Sabit Bro/Desktop/facebook-chat-api-master/pictures/${imageName}.jpg`;

          // Save the image to the specified directory
          response.data.pipe(fs.createWriteStream(imagePath))
            .on('finish', () => {
              // Send the image to the chat
              api.sendMessage({
                body: `Here is an image of the anime character`,
                attachment: fs.createReadStream(imagePath)
              }, threadId, (err) => {
                if (err) {
                  console.error(err);
                  return;
                }

                console.log(`Sent image attachment '${imageName}' to thread ${threadId}`);

                // Delete the image file after sending
                fs.unlink(imagePath, (err) => {
                  if (err) {
                    console.error(err);
                    return;
                  }

                  console.log(`Deleted image file '${imagePath}'`);
                });
              });
            })
            .on('error', (err) => {
              console.error(err);
              sendErrorMessage(api, threadId, 'Failed to download the image.');
            });
        });
      } else {
        sendErrorMessage(api, threadId, 'No image found for the provided name.');
      }
    })
    .catch(error => {
      console.error(error);
      sendErrorMessage(api, threadId, 'Failed to fetch image from Google.');
    });
}








//Send image related search from Unsplash
// Send an image related to the provided name from Unsplash
function sendImageFromUnsplash(api, threadId, imageName) {
  downloadImageFromUnsplash(imageName, (err, imagePath) => {
    if (err) {
      console.error(err);
      sendErrorMessage(api, threadId, "Failed to download the image from Unsplash.");
      return;
    }

    // Send the image to the chat
    api.sendMessage(
      {
        body: `Here is an image of ${imageName} from Unsplash`,
        attachment: fs.createReadStream(imagePath),
      },
      threadId,
      (err) => {
        if (err) {
          console.error(err);
          return;
        }

        console.log(`Sent image attachment '${imageName}' to thread ${threadId}`);

        // Delete the image file after sending
        fs.unlink(imagePath, (err) => {
          if (err) {
            console.error(err);
            return;
          }

          console.log(`Deleted image file '${imagePath}'`);
        });
      }
    );
  });
}


//anime guessing game

// Define a variable to keep track of the active game
let gameActive = false;
let animeCharacter = ''; // Variable to store the current anime character name

// List of anime character names
const animeCharacterNames = [
  "Hinata",
  "Naruto",
  "Goku",
  "Luffy",
  "Sakura",
  "Sasuke",
  "Ichigo",
  "Eren",
  "Mikasa",
  "Levi",
  "Gon",
  "Killua",
  "Vegeta",
  "Miku",
  "Light",
  "Saitama",
  "Kaneki",
  "Lelouch",
  "Edward",
  "Luffy"
];

// Process the player's answer
function processAnswer(api, threadId, guessedAnswer) {
  // Check if the provided answer is correct
  if (isCorrectAnswer(guessedAnswer)) {
    sendMessage(api, threadId, "Congratulations! The guess was correct.");
    gameActive = false;
  } else {
    sendMessage(api, threadId, "Wrong answer! Try again.");
  }
}

// Send a random anime character image and start the guessing game
function sendAnimeCharacterImage(api, threadId) {
  try {
    // Check if a game is already active
    if (gameActive) {
      sendMessage(api, threadId, "A game is already in progress. Please wait for it to finish.");
      return;
    }

    // Choose a random anime character name from the list
    const randomIndex = Math.floor(Math.random() * animeCharacterNames.length);
    animeCharacter = animeCharacterNames[randomIndex];

    console.log(`Picked anime character: ${animeCharacter}`);

    // Send a random anime character image from Google
    sendAnimeFromGoogle(api, threadId, animeCharacter);

    // Send a message to start the guessing game
    const message = `Guess the anime character in 20 seconds!. Use !ans command to give the answer`;
    sendMessage(api, threadId, message);

    // Set the game as active
    gameActive = true;

    // Start a timer for 20 seconds to wait for the answer
    const timer = setTimeout(() => {
      if (gameActive) {
        sendMessage(api, threadId, "Times up! Game reset.");
        deleteImage();
        gameActive = false;
      }
    }, 20000);

    // Listen for the user's answer
    api.listenMqtt((err, message) => {
      if (err) {
        console.error(err);
        return;
      }

      if (message.body && message.threadID === threadId) {
        const body = message.body.trim();

        // Check if the message starts with the prefix and a game is active
        if (body.startsWith(prefix) && gameActive) {
          const [command, ...args] = body.slice(prefix.length).split(" ");

          if (command.toLowerCase() === "ans") {
            const guessedAnswer = args.join(" ").trim();
            processAnswer(api, threadId, guessedAnswer); // Call the processAnswer function
          }
        }
      }
    });
  } catch (error) {
    console.error('An error occurred:', error);
    // Handle the error as needed
    // For example, you can log the error, send an error message, or take other appropriate steps
    // Note that the current state of the bot may be inconsistent due to the error
  }
}

// Check if the provided answer is correct
function isCorrectAnswer(guessedAnswer) {
  const similarity = calculateSimilarity(animeCharacter, guessedAnswer);
  return similarity >= 0.1;
}

// Calculate the similarity between two strings
function calculateSimilarity(str1, str2) {
  const length = Math.max(str1.length, str2.length);
  let matches = 0;

  for (let i = 0; i < length; i++) {
    if (str1[i] && str2[i] && str1[i].toLowerCase() === str2[i].toLowerCase()) {
      matches++;
    }
  }

  return matches / length;
}

// Delete the downloaded image
function deleteImage() {
  try {
    const imagePath = path.join(__dirname, "pictures", "anime_character.jpg");

    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error(err);
        return;
      }

      console.log(`Deleted image file '${imagePath}'`);
    });
  } catch (error) {
    console.error('An error occurred while deleting the image:', error);
    // Handle the error as needed
  }
}
