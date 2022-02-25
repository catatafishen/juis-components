import {Component} from "./Component.js";
import DomNodeInterface, {DomNodeInterface as Node} from "./DomNodeInterface.js";
import {createTextNode} from "./ComponentUtils.js";
import {removeByValue} from "juis-commons/JuisUtils.js";

function Container(node) {
    let container = new Component(node);
    let children = [];

    const isComponent = component => component && component.getNode && component.getNode() instanceof Node;
    const set = (target, propertyName, propertyValue) => {
        if (propertyName !== "nextListenable") {
            let newComponent = isComponent(propertyValue)
            let oldComponent = isComponent(target[propertyName]);
            if (newComponent && oldComponent) {
                target.replaceChild(propertyValue, target[propertyName]);
            } else if (newComponent) {
                target.appendChild(propertyValue);
            } else if (oldComponent) {
                target.removeChild(target[propertyName]);
            }
        }
        target[propertyName] = propertyValue;
        return true;
    };
    const getPrototypeOf = function (target) {
        return Component.prototype;
    };
    const proxy = new Proxy(container, {set, getPrototypeOf});

    const wrapTextNodes = (child) => {
        if (typeof child === "string") {
            child = createTextNode(child);
        }
        return child;
    }

    container.appendChild = child => {
        child = wrapTextNodes(child);
        container.getNode().appendChild(child.getNode());
        return container.attachChild(child);
    };

    container.insertBefore = (child, existingChild) => {
        child = wrapTextNodes(child);
        if (!existingChild) {
            existingChild = children[0];
        }
        if (!existingChild) {
            return container.appendChild(child);
        }
        container.getNode().insertBefore(child.getNode(), existingChild.getNode());
        return container.attachChild(child);
    };

    let childrenByOrdinal = [];
    container.insertOrderedChild = (child, ordinal) => {
        let previousChild = childrenByOrdinal[ordinal];
        childrenByOrdinal[ordinal] = child;
        if (previousChild) {
            return container.replaceChild(child, previousChild);
        }
        let nextSibling = childrenByOrdinal.find((sibling, siblingOrdinal) => {
            return sibling && siblingOrdinal > ordinal && sibling !== child;
        });

        if (nextSibling) {
            return container.insertBefore(child, nextSibling);
        }
        return container.appendChild(child);
    };

    /**
     * Attach a child to this container component. Use this when the child has already been added in the DOM.
     * Usually you should call appendChild or insertBefore which also handles the DOM changes. This method is public so
     * that situations where the DOM is changed by code outside of JuiS can be handled.
     * @param child
     */
    container.attachChild = (child) => {
        children.push(child);
        child.nextListenable = proxy;
        triggerNavigate(child);
        return child;
    }

    container.removeChild = child => {
        container.detachChild(child);
        container.getNode().removeChild(child.getNode());
        removeByValue(childrenByOrdinal, child);
    };


    container.detachChild = child => {
        removeByValue(children, child);
        if (child.nextListenable === proxy) {
            child.nextListenable = undefined;
        }
    };

    container.moveFirst = child => {
        if (!children.includes(child)) {
            throw new Error("Element is not a child of this container");
        }
        if (children.length > 1) {
            removeByValue(children, child);
            container.getNode().insertBefore(child.getNode(), children[0].getNode());
            children.unshift(child);
        }
    };

    container.replaceChild = (newChild, oldChild) => {
        removeByValue(children, oldChild);
        children.push(newChild);
        if (oldChild.nextListenable === proxy) {
            oldChild.nextListenable = undefined;
        }
        newChild.nextListenable = proxy;
        container.getNode().replaceChild(newChild.getNode(), oldChild.getNode());
        triggerNavigate(newChild);
        return newChild;
    };

    container.removeAllChildren = () => {
        Object.keys(container).forEach((child) => {
            if (children.includes(container[child])) {
                delete container[child];
            }
        });
        children.forEach(child => child.nextListenable = null);
        children = [];
        container.getNode().removeAllChildren();

    };

    container.forEachChild = (callback) => {
        children.forEach(callback);
    };

    container.forChildIndex = (callback, index) => {
        callback(children[index]);
    };

    container.getChildIterator = () => {
        let index = -1;
        let child;
        return {
            next: () => {
                index++;
                if (index >= children.length) {
                    index = 0;
                }
                child = children[index];
                return child;
            },
            previous: () => {
                index--;
                if (index < 0) {
                    index = children.length - 1;
                }
                child = children[index];
                return child;
            },
            current: () => {
                return child;
            }
        }
    };

    container.overrideMethod("whenReady", (overridden) => {
        return overridden()
            .then(() => Promise.all(children.map(child => child.whenReady())))
            .then(() => container);
    });
    container.overrideMethod("destroy", (overridden) => {
        children.forEach(child => child.destroy());
        container.removeAllChildren();
        overridden();
    });

    let navigateEvent;
    proxy.on("navigate", event => {
        navigateEvent = event;
        children.forEach(triggerNavigate);
    });

    const triggerNavigate = (child) => {
        if (navigateEvent) {
            child.trigger("navigate", {...navigateEvent}, {propagating: false});
        }
    }

    return proxy;
}

function createContainer(callback, classNames, tagName) {
    let node = new DomNodeInterface(tagName || "DIV", classNames || []);
    let container = new Container(node);
    container.callback(callback);
    return container;
}

export {createContainer as default, Container};
