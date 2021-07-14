function Property(paint, defaultValue, skipInitialPaint = false) {
    let paintFunctions;
    this.getPaint = () => {
        if (!paintFunctions) {
            return paint;
        }
        return function (newValue, oldValue) {
            return paintFunctions
                .filter(paintFunction => paintFunction !== undefined)
                .forEach(paintFunction => paintFunction.call(this, newValue, oldValue));
        }
    };
    this.getDefaultValue = () => defaultValue;
    this.hasDefault = () => defaultValue !== undefined;
    this.skipInitialPaint = () => !!skipInitialPaint;
    this.extend = (paintFunction) => {
        if (!paintFunctions) {
            paintFunctions = [paint];
        }
        if (paintFunction) {
            paintFunctions.push(paintFunction.getPaint ? paintFunction.getPaint : paintFunction);
        }
        return this;
    };
}

function CssProperty(...cssClasses) {
    return new Property(function (value) {
        if (value) {
            cssClasses.forEach(cssClass => this.getNode().addCssClass(cssClass));
        } else {
            cssClasses.forEach(cssClass => this.getNode().removeCssClass(cssClass));
        }
    }, false);
}

export {Property as default, CssProperty}
