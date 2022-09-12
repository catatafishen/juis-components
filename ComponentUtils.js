import Container from "./Container.js";
import {createDomNodeInterfaceForText} from "./DomNodeInterface.js";
import {Component} from "./Component.js";
import {arrayWrap} from "juis-commons/JuisUtils.js";

/**
 * Creates a container and puts the given components inside that container.
 * @param tagName The HTML tag for the new container
 * @param components One or many components to be placed inside the container
 * @returns Container The container component
 */
function wrap(tagName, ...components) {
    return new Container((wrapper) => {
        components.forEach(component => {
            wrapper.appendChild(component);
        });
    }, [], tagName);
}

/**
 * Container that requires all it's children to have a given html-tag. If something else is added the child is wrapped.
 * @param childTagName      The tag name required for all children
 * @param childCssClasses   Css classes required on the child
 * @param tagName           HTML tag for the container
 * @param cssClasses        Css classes for the container
 * @constructor
 */
function WrapperContainer(childTagName, childCssClasses, tagName, cssClasses) {
    return new Container((parent) => {
        parent.overrideMethod("appendChild", function (overridden, child) {
            let wrappedChild;
            if (child.getNode().getTagName() === childTagName) {
                wrappedChild = child;
            } else {
                wrappedChild = wrap(childTagName, child);
            }
            childCssClasses.forEach(wrappedChild.getNode().addCssClass);
            return overridden(wrappedChild);
        });
        parent.overrideMethod("insertBefore", function (overridden, newChild, existingChild) {
            let wrappedChild;
            if (newChild.getNode().getTagName() === childTagName) {
                wrappedChild = newChild;
            } else {
                wrappedChild = wrap(childTagName, newChild);
            }
            childCssClasses.forEach(wrappedChild.getNode().addCssClass);
            return overridden(wrappedChild, existingChild);
        });
        parent.overrideMethod("insertOrderedChild", function (overridden, child, ordinal) {
            let wrappedChild;
            if (child.getNode().getTagName() === childTagName) {
                wrappedChild = child;
            } else {
                wrappedChild = wrap(childTagName, child);
            }
            childCssClasses.forEach(wrappedChild.getNode().addCssClass);
            return overridden(wrappedChild, ordinal);
        });
    }, cssClasses, tagName);
}

let getChildCssClassMixin = (...cssClasses) => function () {
    this.overrideMethod("appendChild", (overridden, child) => {
        [...cssClasses].forEach(child.getNode().addCssClass);
        overridden(child);
    });
    this.overrideMethod("replaceChild", (overridden, newChild, oldChild) => {
        [...cssClasses].forEach(newChild.getNode().addCssClass);
        overridden(newChild, oldChild);
    });
};
/**
 * @callback componentCallback
 * @param component {Component}
 * @this {Component}
 */
/**
 * @callback componentConstructor
 * @param defaultCallback {componentCallback}
 * @param defaultClassNames {[string]=}
 * @param defaultTagName {string=}
 * @returns component {Component}
 */

/**
 *
 * @param componentConstructor {componentConstructor}
 * @param defaultCallback {componentCallback}
 * @param defaultClassNames {[string]=}
 * @param defaultTagName {string=}
 * @returns {componentConstructor}
 */
let extendComponent = (componentConstructor, defaultCallback, defaultClassNames, defaultTagName) => {
    let constructor = function (callback, classNames, tagName) {
        return new componentConstructor(component => {
            if (defaultCallback) {
                defaultCallback.call(component, component);
            }
            if (callback) {
                callback.call(component, component);
            }
        }, arrayWrap(defaultClassNames).concat(arrayWrap(classNames)), tagName || defaultTagName)
    };
    constructor.defaultCallback = defaultCallback;
    constructor.defaultClassNames = defaultClassNames;
    constructor.defaultTagName = defaultTagName;
    return constructor;
};

const joinComponents = (...constructors) => {
    return function (callback, classNames = [], tagName) {
        let constructorsCopy = [...constructors];
        tagName = tagName || constructorsCopy.map(constructor => constructor.defaultTagName)[0];
        let classNamesCopy = [...classNames, ...constructorsCopy.flatMap(constructor => constructor.defaultClassNames)];

        let firstConstructor = constructorsCopy.pop();
        return new firstConstructor(function (component) {
            constructorsCopy.forEach(constructor => {
                if (constructor.defaultCallback) {
                    constructor.defaultCallback.call(component, component);
                }
            });
            callback.call(component, component);
        }, classNamesCopy, tagName);
    };
};

function createTextNode(text) {
    if (text === null || text === undefined) {
        text = "";
    }
    let node = createDomNodeInterfaceForText(text);
    return new Component(node);
}

export {WrapperContainer, getChildCssClassMixin, extendComponent, joinComponents, createTextNode};
