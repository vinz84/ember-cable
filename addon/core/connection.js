import Ember from 'ember';
import ConnectionMonitor from 'ember-cable/core/connection_monitor';

export default Ember.Object.extend({
  consumer: null,
  connected: false,

  init() {
    this._super(...arguments);
    this.open();
    this.set('monitor', ConnectionMonitor.create({ connection: this }));
  },

  send(data) {
    if(this.isOpen()) {
      this.get('webSocket').send(JSON.stringify(data));
    }
  },

  open() {
      this.set('webSocket', new WebSocket(this.get('consumer.url')));
      
      for (var eventName in this.events) {
        this.get('webSocket')[`on${eventName}`] = this.events[eventName].bind(this);
        if(eventName == 'error') {
          this.get('consumer.subscriptions').notify(data.identifier, 'errorConnection', eventName);
        }
      }
    
  },
  
  

  close() {
    Ember.tryInvoke(this.get('webSocket'), 'close');
  },

  reopen() {
    if(this.isClose()){
      this.open();
    } else {
      this.close();
      Ember.run.later(this, () => {
        this.open();
      }, 500);
    }
  },

  isClose() {
    return !this.isOpen();
  },

  isOpen() {
    return Ember.isEqual(this.get('connected'), true);
  },

  disconnect() {
    this.set('connected', false);
    this.get('consumer.subscriptions').notifyAll('disconnected');
  },

  events: {
    message(event) {
      let data = JSON.parse(event.data);
      switch (data.type) {
        case 'welcome':
          this.get('monitor').connected();
          break;
        case 'ping':
          this.get('monitor').ping();
          break;
        case 'confirm_subscription':
          this.get('consumer.subscriptions').notify(data.identifier, 'connected');
          break;
        case 'reject_subscription':
          this.get('consumer.subscriptions').reject(data.identifier);
          break;
        default:
          this.get('consumer.subscriptions').notify(data.identifier, 'received', data.message);
      }
      
      // Rail 4.2 Hack (wrong old ping format)
      if(data.identifier == "_ping") {
        this.get('monitor').ping();
      }
      

    },

    open() {
      this.set('connected', true);
      this.get('consumer.subscriptions').reload();
    },

    close() {
      this.disconnect();
    },

    error() {
      this.disconnect();
    }
  }

});
