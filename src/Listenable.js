function removeByValue(array, item) {
    let index = array.indexOf(item);
    if (index !== -1) array.splice(index, 1);
    return array;
}

const createListener = function (listenable, listensTo, handler, once) {
    let listener = new Listener(listensTo, handler, listenable, once);
    if (!listenable[idKey]) {
        listenable[idKey] = Symbol();
        listeners.set(listenable[idKey], []);
    }
    listeners.get(listenable[idKey]).push(listener);
    listenerAddedEvent(listenable, listener);
    firePersistingEvents(listenable, listensTo);
    return listener;
};

const listenerAddedEvent = function (listenable, listener) {
    listenable.trigger("listenerAdded", {"listener": listener});
};

const firePersistingEvents = function (listenable, listensTo) {
    if (listenable.persistingEvents && listenable.persistingEvents[listensTo]) {
        listenable.fire(listenable.persistingEvents[listensTo], true);
    }
};

const Listener = function (listensTo, handler, thisListenable, once) {
    let autoResume = false;
    if (!Array.isArray(listensTo)) {
        listensTo = [listensTo];
    }
    this.listensTo = listensTo;
    this.active = true;
    this.pause = () => this.active = false;
    this.pauseOnce = () => {
        this.active = false;
        autoResume = true;
    }
    this.resume = () => {
        this.active = true;
        autoResume = false;
    };
    let redirectTo;
    this.redirect = (listener) => redirectTo = listener;

    this.handle = (event) => {
        if (!this.listensTo.includes(event.getType())) {
            return;
        }
        if (redirectTo) {
            event.setNext(redirectTo);
            return;
        }
        if (!this.active) {
            if (autoResume) {
                this.resume();
            }
            return;
        }
        let returnValue = handler.call(thisListenable, event.getData(), event);
        if (event.isResolvable()) {
            event.resolve(returnValue);
        }
        if (once === true) {
            this.destruct();
        }
    };
    this.destruct = function () {
        this.active = false;
        removeByValue(listeners.get(thisListenable[idKey]), this);
    };
};

const Event = function (type, data, eventProperties) {
    let next;
    let propagationPath = [eventProperties.origin];
    let resolved = false;
    this.setNext = (listenable) => next = listenable;
    this.getNext = () => next;
    this.getType = () => type;
    this.getData = () => data;
    this.getOrigin = () => eventProperties.origin;
    this.getPropagationPath = () => [...propagationPath];
    this.stopPropagation = () => eventProperties.propagating = false;
    this.isPropagating = () => !!eventProperties.propagating;
    this.isPersistent = () => !!eventProperties.persistent;
    this.resolve = (result) => {
        if (resolved) {
            throw new Error("Tried to resolve event " + type + " more than once. Value was " + result);
        }
        if (eventProperties.resolve) {
            eventProperties.resolve(result);
        }
        this.stopPropagation();
        resolved = true;
    }
    this.isResolved = () => resolved;
    this.isResolvable = () => !!eventProperties.resolve;

    this.propagate = () => {
        if (eventProperties.propagating) {
            if (next && next.fire) {
                let tempNext = next;
                propagationPath.unshift(next);
                this.setNext(next.nextListenable);
                tempNext.fire(this);
            } else {
                this.stopPropagation();
                if (eventProperties.reject) {
                    eventProperties.reject(`Unhandled event of type ${type}. Event data: ${JSON.stringify(data)}`);
                }
            }
        }
    };
};

const listeners = new Map(); // ListanableId -> [listeners]
const idKey = Symbol();
export default function () {
    this.fire = function (event, local) {
        if (this[idKey] && listeners.has(this[idKey])) {
            [...listeners.get(this[idKey])].forEach((listener) => {
                if (!event.isResolved()) {
                    return listener.handle(event);
                }
            });
        }
        if (event.isPersistent()) {
            if (!this.persistingEvents) {
                //There can ever only be one persisting event of each type on a single element
                this.persistingEvents = {};
            }
            this.persistingEvents[event.getType()] = event;
        }
        if (!local) {
            event.propagate();
        }
    };

    this.setEventOrigin = function (origin) {
        this.trigger = (...triggerArgs) => origin.trigger.apply(origin, triggerArgs);
    };

    this.on = function (listensTo, handler) {
        return createListener(this, listensTo, handler);
    };

    this.replaceListeners = function (listensTo, handler) {
        listeners.get(this[idKey])
            .filter(listener => listener.listensTo.includes(listensTo))
            .forEach(listener => listener.destruct());
        return this.on(listensTo, handler);
    };

    this.redirectEvent = function (listensTo, listener) {
        let redirectListener = createListener(this, listensTo, () => {
        });
        redirectListener.redirect(listener);
        return redirectListener;
    }

    this.when = function (listensTo) {
        return new Promise(resolve => this.listenOnce(listensTo, resolve));
    };

    this.listenOnce = function (listensTo, handler) {
        return createListener(this, listensTo, handler, true);
    };

    this.triggerOnce = function (type, data, properties = {}) {
        return new Promise((resolve, reject) => {
            properties = {...properties, resolve, reject};
            this.trigger(type, data, properties);
        });
    }

    this.removeAllListeners = function () {
        listeners.delete(this[idKey]);
    }

    this.trigger = function (type, data, properties = {}) {
        properties = {origin: this, propagating: true, persistent: false, ...properties};
        let event = new Event(type, data, properties);
        event.setNext(this.nextListenable);
        if (properties.skipOrigin) {
            event.propagate();
        } else {
            this.fire(event);
        }
    };

    this.dontPropagate = function (events) {
        if (!Array.isArray(events)) {
            events = [events];
        }
        events.forEach(eventName => this.on(eventName, (ignore, event) => event.stopPropagation()));
    }
    this.nextListenable = undefined;
};
