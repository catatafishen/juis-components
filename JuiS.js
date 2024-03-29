import {registerNodeInterface} from "./Component.js";
import {Container} from "./Container.js";
import DomNodeInterface, {DomNodeInterface as DomNodeInterfaceByNode, registerRootElement} from "./DomNodeInterface.js";

export default function (rootElement, constructor) {
    registerNodeInterface(DomNodeInterface);
    registerRootElement(rootElement);
    let domNodeInterface = new DomNodeInterfaceByNode(rootElement);
    let rootView = new Container(domNodeInterface);
    rootView.getNode().addCssClass("juis");
    window.onpopstate = function () {
        rootView.trigger("navigate", {url: document.location.pathname}, {propagating: false});
    };

    let rootComponent = new constructor(rootView);
    const urlParameters = new URLSearchParams(window.location.search);
    const parameters = {};
    urlParameters.forEach((value, key) => parameters[key] = value);
    rootView.trigger("navigate", {url: document.location.pathname, parameters});
    return rootComponent;
}
