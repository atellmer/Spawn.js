import { INIT_ACTION } from './constants';
import {
  clone,
  mapSubscribers,
  checkCallback,
  removeCallback,
  findZoneValue,
  plainZoneValue,
  autorun,
  applyInterceptors,
  applyLogic
} from './methods';
import {
  isPlainObject,
  isFunc,
  isString,
  hasKey,
  error
} from '../helpers';


const Spawn = function (initialState, interceptors) {
  let state = initialState,
      prevState = {},
      virtualState = {},
      subscribers = { '*': [] },
      subscribersArgs = { '*': [] };

  this.select = selector => {
    if (isString(selector)) {
      switch (selector) {
      case '*': return clone(state);
      default: return findZoneValue(selector, state);
      }
    }
    if (isFunc(selector)) return selector(clone(state));

    return error('spawn-x: the select method takes only a string or function as argument!');
  }

  this.detect = (zone, cb, ...args) => {
    if (!isString(zone)) return error('spawn-x: the detect method takes only a string for first argument!');
    if (!isFunc(cb)) return error('spawn-x: the detect method takes only a function for second argument!');

    if (!subscribers[zone] && !subscribersArgs[zone]) {
      subscribers[zone] = [];
      subscribersArgs[zone] = [];
    }

    if (zone === '*' && checkCallback(subscribers[zone], cb)) {
      subscribers[zone].push(cb);
      subscribersArgs[zone].push(args);
      mapSubscribers(subscribers[zone], subscribersArgs[zone]);

      return this;
    }

    if (checkCallback(subscribers[zone], cb)) {
      subscribers[zone].push(cb);
      subscribersArgs[zone].push(args);
    } else {
      return this;
    }

    if (findZoneValue(zone, state)) {
      virtualState = clone(state);
      applyLogic({
        zone,
        subscribers,
        subscribersArgs,
        state,
        prevState,
        afterUpdate: false 
      });
    }

    return this;
  }

  this.reject = (zone, cb) => {
    if (!isString(zone)) return error('spawn-x: the reject method takes only a string for first argument!');
    if (!isFunc(cb)) return error('spawn-x: the reject method takes only a function for second argument!');

    if (subscribers[zone]) {
      removeCallback(subscribers[zone], cb);
    }

    return this;
  }

  this.update = (zone, action) => {
    if (!isString(zone)) return error(`spawn-x: the update method takes only a string for first argument!`);
    if (!isPlainObject(action)) return error(`spawn-x: action must be a plain object!`);
    if (!hasKey(action, 'data')) return error(`spawn-x: action must have a 'data' key!`);
    if (!hasKey(action, 'type')) return error(`spawn-x: action must have a 'type' key!`);
    if (!(isString(action.type))) return error(`spawn-x: type of action must be a string!`);

    applyInterceptors(this)(action)(interceptors.concat(update));

    return this;

    function update() {
      return () => action => {
        let zoneParts = zone.split('.'),
            parent = clone(state),
            newState = parent;

        if (zone === '*') {
          if (isPlainObject(action.data)) {
            state = clone(action.data);
            prevState = {};
            virtualState = {};
            autorun(subscribers, subscribersArgs);

            return this;
          }

          return error(`spawn-x: the update method takes only a plain object for replace full state! Check your update('*') method.`);
        }

        for (let i = 0; i < zoneParts.length; i++) {
          if (!parent.hasOwnProperty(zoneParts[i])) {
            parent[zoneParts[i]] = {};
          }
          if (i === zoneParts.length - 1) {
            parent[zoneParts[i]] = action.data;
            break;
          }
          parent = parent[zoneParts[i]];
        }

        virtualState = clone(newState);

        if (plainZoneValue(zone, state) !== plainZoneValue(zone, virtualState)) {
          state = clone(virtualState);
          applyLogic({
            zone,
            subscribers,
            subscribersArgs,
            state,
            prevState,
            afterUpdate: true 
          });
          prevState = clone(virtualState);
        } else {
          mapSubscribers(subscribers['*'], subscribersArgs['*']);
        }
      }
    }
  }

  applyInterceptors(this)(INIT_ACTION)(interceptors.concat(store => next => action => next(action)));
}

export {
  Spawn
}
