import Property from "./Property.js";
import Listenable from "juis-commons/Listenable.js";

let NodeInterface;
let registerNodeInterface = newNodeInterface => {
    if (NodeInterface) {
        throw new Error("Node interface can only be registered once");
    }
    NodeInterface = newNodeInterface;
};
/**
 *
 * @param node
 * @returns {Component}
 * @constructor
 * @mixes Listenable
 */
let Component = function (node) {
    let propertyValues = {};
    let handler = {};
    let proxy = new Proxy(this, handler);
    this.getNode = () => node;
    let properties = {};

    let addProperty = (propertyName, property) => {
        properties[propertyName] = property;
    };

    this.extendProperty = (propertyName, paintFunction) => {
        if (!properties[propertyName]) {
            throw new Error(`No such property: ${propertyName}`);
        }
        properties[propertyName].extend(paintFunction)
    };

    let hasProperty = (propertyName) => {
        return Object.keys(properties).includes(propertyName);
    };

    let paintProperty = (property, value, oldValue) => {
        const paintFunction = property.getPaint();
        if (paintFunction) {
            paintFunction.call(this, value, oldValue);
        }
    };

    const registeredEvents = [];
    this.registerDomEvents = function (eventName) {
        if (!registeredEvents.includes(eventName)) {
            node.addEventListener(eventName, (eventPackage) => proxy.trigger(eventName, eventPackage));
            registeredEvents.push(eventName);
        }
    };

    this.preventDefaultDomEvent = function (eventName) {
        node.preventDefaultDomEvent(eventName);
    };

    this.navigate = (url, parameters, eventData) => {
        return this.triggerOnce("REQUEST_NAVIGATE", {url, parameters, ...eventData});
    };

    this.refreshProperty = (propertyName, newValue) => {
        let property = properties[propertyName];
        if (!property) {
            throw new Error("Unknown property " + propertyName);
        }
        let oldValue = propertyValues[propertyName];
        newValue = newValue || oldValue;
        paintProperty(properties[propertyName], newValue, oldValue);
    };

    let boundListeners = new Set();
    this.bindListener = (listener) => {
        return boundListeners.add(listener);
    }

    let destroyed = false;
    this.destroy = function () {
        boundListeners.forEach(listener => listener.destruct());
        this.removeAllListeners();
        destroyed = true;
    };
    this.isDestroyed = () => destroyed;

    let setProperty = (propertyName, property) => {
        if (property instanceof Property) {
            addProperty(propertyName, property);
            if (property.hasDefault()) {
                propertyValues[propertyName] = property.getDefaultValue();
                if (!property.skipInitialPaint()) {
                    paintProperty(property, propertyValues[propertyName]);
                }
            }
            return true;
        }
        if (hasProperty(propertyName)) {
            let oldValue = propertyValues[propertyName];
            propertyValues[propertyName] = property;
            paintProperty(properties[propertyName], property, oldValue);
            return true;
        }
        this[propertyName] = property;
        return true;
    };

    this.addCssClass = function (...className) {
        className.forEach(className => this.getNode().addCssClass(className));
    };

    this.overrideHandler = (override) => {
        Object.assign(handler, override(Object.assign({}, handler)));
    };

    const thisComponent = this;
    this.getComponentInstance = () => thisComponent;
    this.equals = (other) => other.getComponentInstance() === thisComponent;
    let waitingForPromises = [];
    this.waitFor = (promise) => waitingForPromises.push(promise);
    this.whenReady = function () {
        return Promise.all(waitingForPromises).then(() => this);
    };

    handler.get = (target, propertyName) => {
        if (target[propertyName] !== undefined) {
            return target[propertyName]
        } else if (hasProperty(propertyName)) {
            return propertyValues[propertyName];
        }
        return undefined;
    };

    handler.set = (target, propertyName, propertyValue) => {
        return setProperty(propertyName, propertyValue);
    };
    addProperty("innerHTML", new Property((value) => node.setInnerHtml(value)));
    return proxy;
};
Listenable.apply(Component.prototype);
Component.prototype.callback = function (...callbacks) {
    callbacks
        .filter(callback => typeof callback === "function")
        .forEach(callback => callback.call(this, this));
};

Component.prototype.overrideMethod = function (methodName, override) {
    let method = this[methodName];
    if (!method || !method.call) {
        throw new Error(`Cannot override unknown method ${methodName}`);
    }
    let obj = this;
    let overridden = function () {
        return method.call(obj, ...arguments);
    };
    this[methodName] = function () {
        return override.call(this, overridden, ...arguments)
    }
};

let createComponent = function (callback, classNames, tagName) {
    let component = new Component(new NodeInterface(tagName, classNames));
    component.callback(callback);
    return component;
};
export {createComponent as default, Component, registerNodeInterface};
