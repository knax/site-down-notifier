require('dotenv').config();
const Telegraf = require('telegraf');
const token = process.env.TELEGRAM_TOKEN;
const fs = require('fs');
const fetch = require('isomorphic-fetch');

class Config {
  constructor() {
    this.chats = [];
    this.update_log = [];
    this.loadConfig();
  }

  get sites() {
    return this.chats.reduce((all, chat) => {
      chat.sites.forEach(site => {
        let found = all.find(it => it.site === site);
        if(!found) {
          found = {
            site: site,
            last_updated: new Date(),
            status: 'n/a',
            subscriber: []
          };
          all.push(found);
        }
        found.subscriber.push(chat.id);
      });
      return all;
    }, []);
  }

  loadConfig() {
    try {
      let result = fs.readFileSync('config.json', 'utf8');
      let config = JSON.parse(result);
      this.chats = config;
    } catch(e) {
      if(e.code === 'ENOENT') {
        fs.writeFileSync('config.json', JSON.stringify([]));
        return;
      }
      console.log(e);
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync('config.json', JSON.stringify(this.chats));
    } catch(e) {
      console.log(e);
    }
  }

  addWebsite(chatId, website) {
    let found = this.chats.find(it => it.id === chatId);
    if(!found) {
      found = {
        id: chatId,
        sites: []
      };

      this.chats.push(found);
    }

    let exist = found.sites.find(it => it === website);
    if(exist) {
      return website + ' already exist';
    }
    found.sites.push(website);
    this.saveConfig();
    return website + ' successfully added';
  }


  removeWebsite(chatId, website) {
    let found = this.chats.find(it => it.id === chatId);
    if(!found) {
      found = {
        id: chatId,
        sites: []
      };

      this.chats.push(found);
    }

    let index = found.sites.findIndex(it => it === website);
    if(index !== -1) {
      found.sites.splice(index, 1);
      this.saveConfig();
      return website + ' successfully deleted';
    }
    // found.sites.push(website);
    return website + ' not found';
  }
}

const config = new Config();

function checkSites(notifyIfSuccess=false, checkChatId='') {
  config.sites.map(site => {
    fetch(site.site).then(res => {
      config.update_log.unshift({
        site: site.site,
        updated_at: new Date(),
        status: `${res.status} - ${res.statusText}`
      });
      if(!res.ok) {
        site.subscriber.map(chatId => {
          if(checkChatId) {
            if(checkChatId === chatId) {
              bot.telegram.sendMessage(chatId, `${site.site} is not ok (${res.status} - ${res.statusText})` );
            }
          }
          bot.telegram.sendMessage(chatId, `${site.site} is not ok (${res.status} - ${res.statusText})` );
        });
      } else {
        if(notifyIfSuccess) {
          site.subscriber.map(chatId => {
            if(checkChatId) {
              if(checkChatId === chatId) {
                bot.telegram.sendMessage(chatId, `${site.site} is (${res.status} - ${res.statusText})` );
              }
            }
            bot.telegram.sendMessage(chatId, `${site.site} is (${res.status} - ${res.statusText})` );
          });
        }
      }
    })
  });
}

const bot = new Telegraf(token);
bot.command('/site_notifier_add', (ctx) => {
  let website_regex = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/g;
  let protocol_regex = /^https?:\/\//g;

  let website = ctx.update.message.text.replace('/site_notifier_add ', '');

  if(!website_regex.test(website)) {
    ctx.reply('Website is not valid ' + website);
    return;
  }

  if(!protocol_regex.test(website)) {
    website = 'http://' + website;
  }

  ctx.reply(config.addWebsite(ctx.update.message.chat.id, website));
});

bot.command('/site_notifier_list', (ctx) => {
  ctx.reply('Sitelist:\n ' + config.sites.map(it => it.site).join('\n'));
});

bot.command('/site_notifier_remove', (ctx) => {
  ctx.reply(config.removeWebsite(ctx.update.message.chat.id, ctx.update.message.text.replace('/site_notifier_remove ', '')));
});

bot.command('/site_notifier_check', (ctx) => {
  checkSites(true, ctx.update.message.chat.id);
});

bot.start((ctx) => {
  // console.log;
  ctx.reply('Welcome!');
});

bot.startPolling()


setInterval(() => {
  checkSites();
  // console.log(config.sites);
}, 1000 * 60);
