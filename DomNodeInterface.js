import {arrayWrap, camelCaseToDash} from "juis-commons/JuisUtils.js";

let rootElement;

let registerRootElement = (newRoot) => {
    if (!rootElement) {
        rootElement = newRoot;
    } else {
        throw new Error("Root can only be registered once per application");
    }
};

const eventListenerOptions = {passive: false, capture: true};
let globalListeners = {};

let createFirstGlobalListener = (eventName) => {
    globalListeners[eventName] = [];

    // Find the node which is furthest down the hierarchy and is listening to this event and call its callback
    rootElement.addEventListener(eventName, (event) => {
        let callbacksPerElement = globalListeners[eventName];
        let element = event.target;
        let eventPackage = packageEvent(element, eventName, event);
        while (element !== null) {
            if (!element.disabled) {
                let elementCallbacks = callbacksPerElement.find(elementCallback => elementCallback.elementGetter() === element);
                if (elementCallbacks) {
                    elementCallbacks.callbacks.forEach(callback => {
                        callback(eventPackage);
                    });
                    break;
                }
            }
            if (element === rootElement) {
                break;
            }
            element = element.parentNode;
        }
    }, eventListenerOptions);
};

let mouseEvents = [
    "click",
    "dblclick",
    "mousedown",
    "mouseenter",
    "mouseleave",
    "mousemove",
    "mouseout",
    "mouseover",
    "mouseup"
];

let packageEvent = (element, eventName, event) => {
    let eventPackage = {};
    if (mouseEvents.includes(eventName)) {
        eventPackage.altKey = event.altKey;
        eventPackage.button = event.button;
        eventPackage.buttons = event.buttons;
        eventPackage.clientX = event.clientX;
        eventPackage.clientY = event.clientY;
        eventPackage.ctrlKey = event.ctrlKey;
        eventPackage.metakEy = event.metakEy;
        eventPackage.movementX = event.movementX;
        eventPackage.movementY = event.movementY;
        if (event.clientX === 0) {
            eventPackage.offsetX = parseInt(element.offsetWidth, 10) / 2;
            eventPackage.offsetY = parseInt(element.offsetWidth, 10) / 2;
        } else {
            eventPackage.offsetX = event.pageX - element.offsetLeft;
            eventPackage.offsetY = event.pageY - element.offsetTop;
        }

        eventPackage.screenX = event.screenX;
        eventPackage.screenY = event.screenY;
        eventPackage.shiftKey = event.shiftKey;
    }
    if (eventName === "keydown") {
        eventPackage.keyCode = event.keyCode;
    }
    if (eventName === "input") {
        eventPackage.data = event.data;
        eventPackage.inputType = event.inputType;
    }
    eventPackage.domEvent = event;
    return eventPackage;
};

let registerGlobalEventListener = (elementGetter, eventName, callbacks) => {
    if (globalListeners[eventName] === undefined) {
        createFirstGlobalListener(eventName);
    }
    globalListeners[eventName].push({elementGetter, callbacks});
};

function createElement(tagName, classNames) {
    let element = document.createElement(tagName || "DIV");
    classNames = arrayWrap(classNames)
        .filter(className => !!className) // Ignore empty, undefined and null values
        .map(camelCaseToDash);
    classNames.unshift("juis");
    element.classList.add(...classNames);
    return element;
}

function DomNodeInterface(element) {
    let placeholder;
    let wrapper;

    this.getActualElement = () => element;

    this.getElement = () => placeholder || wrapper || element;

    this.getTagName = () => wrapper ? wrapper.tagName : element.tagName;

    let getDomNode = () => {
        if (element.style) {
            return element;
        }
        if (!wrapper) {
            this.addWrapper("SPAN");
        }
        return wrapper;
    };

    this.addCssClass = (className) => getDomNode().classList.add(camelCaseToDash(className));

    this.addWrapperCssClass = (className) => (wrapper || getDomNode()).classList.add(camelCaseToDash(className));

    this.removeCssClass = (className) => getDomNode().classList.remove(camelCaseToDash(className));

    this.setStyle = (cssPropertyName, cssValue) => setStyle(getDomNode(), cssPropertyName, cssValue);

    this.setWrapperStyle = (cssPropertyName, cssValue) => setStyle(wrapper || getDomNode(), cssPropertyName, cssValue);

    const setStyle = (styleElement, cssPropertyName, cssValue) => {
        if (cssValue === undefined) {
            styleElement.style[cssPropertyName] = "";
        } else {
            styleElement.style[cssPropertyName] = cssValue;
        }
    };

    this.setAttribute = (attributeName, attributeValue) => (element.setAttribute ? element : wrapper).setAttribute(attributeName, attributeValue);
    this.setElementProperty = (propertyName, propertyValue) => element[propertyName] = propertyValue;
    this.getElementProperty = (propertyName) => element[propertyName];
    this.getAttribute = attributeName => element[attributeName];
    this.removeAttribute = (attributeName) => element.removeAttribute(attributeName);

    this.setText = (text) => {
        const TEXT_TYPE = 3;
        if (typeof text === "number") {
            text = text.toString(10);
        }
        let newTextNode = document.createTextNode(text || "");
        if (element.firstChild && element.firstChild.nodeType === TEXT_TYPE) {
            element.replaceChild(newTextNode, element.firstChild);
        } else {
            if (element.hasChildNodes()) {
                element.insertBefore(newTextNode, element.firstChild);
            } else {
                element.appendChild(newTextNode);
            }
        }
    };

    this.setInnerHtml = (innerHTML) => element.innerHTML = innerHTML;

    this.getInnerHtml = () => element.innerHTML;

    this.appendInnerHtml = (innerHTML) => element.innerHTML += innerHTML;

    this.appendChild = (child) => element.appendChild(child.getElement());

    this.insertBefore = (newChild, existingChild) => element.insertBefore(newChild.getElement(), existingChild.getElement());

    this.replaceChild = (newChild, oldChild) => element.replaceChild(newChild.getElement(), oldChild.getElement());

    this.removeChild = (child) => element.removeChild(child.getElement());

    this.hasParent = () => !!this.getElement().parentNode;

    this.replaceSelf = (replacement) => {
        this.getElement().replaceWith(replacement.getElement());
    };

    this.removeAllChildren = () => {
        while (element.lastChild) {
            element.removeChild(element.lastChild);
        }
    };

    this.togglePlaceholder = (state, message = "placeholder") => {
        const container = wrapper || element;
        if (state) {
            if (!placeholder) {
                placeholder = document.createComment(message);
            } else {
                placeholder.data = message;
            }

            if (container.parentNode) {
                container.parentNode.replaceChild(placeholder, container);
            }
        } else {
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.replaceChild(container, placeholder);
            }
            placeholder = undefined;
        }
    };

    this.changeType = (newTagName) => {
        let newElement = document.createElement(newTagName);
        let children = [];
        for (let i = 0; i < element.childNodes.length; i++) {
            children.push(element.childNodes[i])
        }
        children.forEach(child => newElement.appendChild(child));
        if (element.parentNode) {
            element.parentNode.appendChild(newElement);
        }
        element.classList.forEach(cssClass => newElement.classList.add(cssClass));
        element.getAttributeNames()
            .forEach(attributeName => newElement.setAttribute(attributeName, element.getAttribute(attributeName)));
        element = newElement;
    };

    this.addWrapper = (tagName, cssClasses = []) => {
        let element = this.getElement();
        let parentNode = element.parentNode;
        wrapper = document.createElement(tagName);
        arrayWrap(cssClasses).forEach(cssClass => {
            wrapper.classList.add(camelCaseToDash(cssClass));
        });
        wrapper.classList.add("juis");
        wrapper.appendChild(element);
        if (parentNode) {
            parentNode.appendChild(wrapper);
        }
        return wrapper;
    };

    this.callMethod = (methodName, ...args) => {
        const executor = resolve => resolve(element[methodName].call(element, ...args));
        return new Promise(executor);
    };

    let callbacks = {};
    this.addEventListener = (eventName, callback) => {
        if (callbacks[eventName]) {
            callbacks[eventName].push(callback);
        } else {
            callbacks[eventName] = [callback];
            registerGlobalEventListener(getDomNode, eventName, callbacks[eventName]);
        }
        if (eventName === "dblclick") {
            addDoubleTapListener(callback)
        }
    };

    /**
     * Trigger dblclick callback also on touch screens
     * @param dblclickCallback
     */
    const addDoubleTapListener = (dblclickCallback) => {
        let previousTapTime = 0;
        let previousTarget;
        const callback = (eventPackage) => {
            let currentTime = new Date().getTime();
            let delta = currentTime - previousTapTime;
            previousTapTime = currentTime;
            if (delta < 600 && previousTarget === eventPackage.domEvent.target) {
                dblclickCallback(eventPackage);
                previousTapTime = 0;
                previousTarget = null;
                eventPackage.domEvent.stopPropagation();
                eventPackage.domEvent.preventDefault();
                window.navigator.vibrate(50);
                return false;
            } else {
                previousTarget = eventPackage.domEvent.target;
            }
        };
        if (callbacks["touchstart"]) {
            callbacks["touchstart"].push(callback);
        } else {
            callbacks["touchstart"] = [callback];
            registerGlobalEventListener(getDomNode, "touchstart", callbacks["touchstart"]);
        }
    }

    this.preventDefaultDomEvent = (eventName) => {
        this.getElement().addEventListener(eventName, (event) => event.preventDefault());
    };
}

DomNodeInterface.prototype.navigate = function (url, parameters) {
    throw new Error("Use request navigate instead");
};

function createDomNodeInterface(tagName, classNames) {
    return new DomNodeInterface(createElement(tagName, classNames));
}

function createDomNodeInterfaceForText(text) {
    return new DomNodeInterface(document.createTextNode(text));
}

export {
    createDomNodeInterface as default,
    DomNodeInterface,
    createDomNodeInterfaceForText,
    registerRootElement,
};
