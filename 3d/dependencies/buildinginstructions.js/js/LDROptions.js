'use strict';

LDR.Options = {};

LDR.Options.initialize = function() {
    this.listeners = [];
    
    // Default values for options (in case of first visit or no cookies:
    this.showOldColors = 0; // 0 = highlight new with red, 1 = highlight new with lime, 2 = all colors normal, 3 = single color old
    this.lineContrast = 0; // 0 = High contrast, 1 = LDraw
    this.bgColor = 0x222222;
    this.pointColor = 0xFF0000;
    this.pointSize = 2;
    this.lineColor = 0x333333;
    this.oldColor = 0xFFFF6F;
    this.showLRButtons = 0; // 0=right big, 1=right normal, 2=both off
    this.showCameraButtons = 1; // 0=+- on right, 1=+- on sides, 2=off
    this.showStepRotationAnimations = 1; // 0=slow, 1=normal speed, 2=off
    this.partsListType = 0; // 0=icons, 1=list
    this.showNotes = 0; // 0=off, 1=on
    this.showPLI = 1; // 0=off, 1=on
    this.rotateModel = 0; // 0=off, 1=on
    this.studHighContrast = 0; // 0=off, 1=on
    this.studLogo = 0; // 0=off, 1...5=Types of logos from LDraw

    // Read values that might be in cookie:
    if(document.cookie) {
        let cookieParts = decodeURIComponent(document.cookie).split(/\s*;\s*/);
        for(let i = 0; i < cookieParts.length; i++) {
            let part = cookieParts[i];
            let equalAt = part.indexOf('=');
            if(equalAt > 1) {
                let key = part.substring(0, equalAt);
                if(this[key] != undefined)
                    this[key] = parseInt(part.substring(equalAt+1));
            }
        } 
    }

    let options = this;
    this.onChange = function(partGeometriesChanged) {
	for(let i = 0; i < options.listeners.length; i++) {
	    options.listeners[i](partGeometriesChanged);
	}
	options.saveOptionsToCookie();
    }
}

LDR.Options.initialize();

LDR.Options.saveOptionsToCookie = function() {
    let options = this;
    function addToKv(v) {
	document.cookie = v + '=' + options[v] + '; SameSite=Strict; expires=Wed, 3 Jun 2122 12:00:01 UTC; path=/';
    }
    // Instructions and general options:
    addToKv("showOldColors");
    addToKv("lineContrast");
    addToKv("showPartsCallouts");
    addToKv("showStepRotationAnimations");
    //addToKv("showCameraButtons");
    addToKv("showLRButtons");
    //addToKv("showPLI");
    addToKv("studHighContrast");
    addToKv("studLogo");
    
    // Parts list-specific:
    addToKv("partsListType");
    addToKv("showNotes");

    // View-specific:
    addToKv("rotateModel");

    // Part view-specific:
    addToKv("pointColor");
    addToKv("pointSize");
    addToKv("bgColor");
}

LDR.Options.setOptionsSelected = function(node, callback) {
    let parent = node.parentNode;
    let children = parent.childNodes;
    for(let i = 0; i < children.length; i++) {
	let child = children[i];
	if(child === node) {
	    callback(i);
	    if(child.getAttribute('class') === 'option')
		child.setAttribute('class', 'option_selected');
	}
	else {
	    if(child.getAttribute('class') === 'option_selected')
		child.setAttribute('class', 'option');	
	}
    }
}

LDR.Options.appendHeader = function(optionsBlock) {
    let headerDiv = document.createElement('div');
    headerDiv.setAttribute('id', 'options_header');
    optionsBlock.appendChild(headerDiv);

    // To top button:
    let toTop = document.createElement('a');
    toTop.setAttribute('href', '#');
    toTop.appendChild(LDR.SVG.makeUpArrow());    
    toTop.id = 'to_top';
    optionsBlock.append(toTop);
    window.onscroll = function() {
        let boundary = window.innerHeight*0.8;
        if (document.body.scrollTop > boundary ||
            document.documentElement.scrollTop > boundary) {
            toTop.style.display = "block";
        }
        else {
            toTop.style.display = "none";
        }
    }

    headerDiv.appendChild(LDR.SVG.makeOptions());
}
LDR.Options.appendFooter = function(optionsBlock) {
    let div = document.createElement('div');
    div.setAttribute('class', 'options_footer');
    let a = document.createElement('a');
    a.setAttribute('href', '#top');

    optionsBlock.appendChild(div);
    div.appendChild(a);
    a.appendChild(LDR.SVG.makeUpArrow());
}
LDR.Options.appendDescriptionBar = function(optionsBlock, columns, description) {
    let tr = document.createElement('tr');
    tr.setAttribute('class', 'options_description_header');
    optionsBlock.appendChild(tr);

    let td = document.createElement('td');
    td.setAttribute('class', 'options_description');
    td.setAttribute('colspan', ""+columns);
    tr.appendChild(td);

    let desc = document.createElement('span');
    desc.innerHTML = description;
    td.appendChild(desc);
}

LDR.Options.appendOldBrickColorOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 4, "Highlight New Parts");
    let options = this;
    let onOldBrickChange = function(idx) {
	options.showOldColors = idx;
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 4, this.showOldColors, onOldBrickChange);
    
    // Color functions:
    let red = () => '#800000';
    let lime = () => '#60FF00';
    let green = () => '#257A3E';
    let blue = () => '#5577FF';
    let gb = [green, blue];
    
    let lineColor = options => LDR.Colors.int2Hex(options.lineColor);
    let oldColor = options => LDR.Colors.int2Hex(options.oldColor);

    let svg;
    function drawParts(x, cnt, cntOld, outlineColor) {
	for(let i = 0; i < cnt; i++) {
	    options.createSvgBlock(x,
				   (-i+0.5)*LDR.Options.svgBlockHeight, 
				   i === cnt-1,
				   i < cntOld ? oldColor : gb[i%2],
				   (i == cnt-1) ? outlineColor : lineColor,
				   svg);
	}
    }

    let dst = 60;
    const w = 20;
    function drawBase(idx) {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-90 -40 180 80');
	buttons[idx].appendChild(svg);
	LDR.SVG.makeThinArrow(svg, w);
        return svg;
    }

    // Red outline:
    svg = drawBase(0);
    drawParts(-dst, 1, 0, red);
    drawParts(dst, 2, 0, red);
    // Lime outline:
    svg = drawBase(1);
    drawParts(-dst, 1, 0, lime);
    drawParts(dst, 2, 0, lime);
    // Paint all in colors:
    svg = drawBase(2);
    drawParts(-dst, 1, 0, lineColor);
    drawParts(dst, 2, 0, lineColor);
    // old parts in single color:
    svg = drawBase(3);
    drawParts(-dst, 1, 0, lineColor);
    drawParts(dst, 2, 1, lineColor);
}

LDR.Options.appendContrastOptions = function(optionsBlock) {
    let self = this;
    let svg;

    let group = this.addTopOptionsGroup(optionsBlock);
    let onChange = function() {
	self.lineContrast = self.lineContrast === 0 ? 1 : 0; // Don't be clever here - lingering values can occur!
        if(self.lineContrast === 1) {
          self.lineColor = 0x333333;
        }
        else {
          self.lineColor = 0;
        }
	self.onChange(false);
        updateSvg();
    };
    let button = this.createButton(group, onChange);
    
    // Color functions:
    let red = () => '#C91A09';
    let redEdge1 = () => '#000000';
    let redEdge2 = () => '#333333';
    let black = () => '#05131D';
    let blackEdge1 = () => '#FFFFFF';
    let blackEdge2 = () => '#595959';
    let brown = () => '#582A12';

    function updateSvg() {
        if(svg) {
            button.removeChild(svg);
        }
        svg = document.createElementNS(LDR.SVG.NS, 'svg');
        svg.setAttribute('viewBox', '-80 -25 160 50');
	button.appendChild(svg);

        if(self.lineContrast === 0) { // High Contrast:
            self.createSvgBlock(-LDR.Options.svgBlockWidth-2, 0, true, red, redEdge1, svg);
            self.createSvgBlock(0, 0, true, brown, red, svg);
            self.createSvgBlock(LDR.Options.svgBlockWidth+2, 0, true, black, blackEdge1, svg);
        }
        else { // Standard LDraw lines:
            self.createSvgBlock(-LDR.Options.svgBlockWidth-2, 0, true, red, redEdge2, svg);
            self.createSvgBlock(0, 0, true, brown, blackEdge2, svg);
            self.createSvgBlock(LDR.Options.svgBlockWidth+2, 0, true, black, blackEdge2, svg);
        }
    }
    updateSvg();
}

/*
  Part color options (points and background color)
*/
LDR.Options.appendPartColorOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 2, "Background and Point Color");
    let options = this;

    // Color functions:
    let bgColor = function(options){return LDR.Colors.int2Hex(options.bgColor);};
    let pointColor = function(options){return LDR.Colors.int2Hex(options.pointColor);};
    let oldColor = function(options){return LDR.Colors.int2Hex(options.oldColor);};
    let lineColor = function(options){return LDR.Colors.int2Hex(options.lineColor);};

    // Build html elements:
    function createPreview(parent, forBG) {
	let preview = document.createElement('td');
	preview.setAttribute('class', 'color_option');
	parent.appendChild(preview);

	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	preview.appendChild(svg);
	if(forBG)
	    options.createSvgBlock(0, 0, true, oldColor, lineColor, svg);
	else
	    options.createSvgPoints(0, 0, pointColor, svg, 2);

	let listener = function() {
	    svg.style.backgroundColor = bgColor(options);
	};
	options.listeners.push(listener);
	listener();

	return preview;
    }
    function createColorInput(parent, color, onChange) {
	let input = document.createElement('input');
	input.setAttribute('class', 'color_input');
	input.setAttribute('type', 'color');
	input.setAttribute('value', color);
	input.addEventListener("input", onChange, false);
	input.addEventListener("change", onChange, false);
	parent.appendChild(input);
	return input;
    }
    let onChange = function() {
	options.bgColor = parseInt(input1.value.substring(1), 16);
	options.pointColor = parseInt(input2.value.substring(1), 16);
	options.onChange(false);
    }

    // Fill in data:
    let preview1 = createPreview(group, true);
    let input1 = createColorInput(preview1, bgColor(options), onChange);

    let preview2 = createPreview(group, false);
    let input2 = createColorInput(preview2, pointColor(options), onChange);
}

/*
Part color options (points and background color)
 */
LDR.Options.appendPartPointSizeOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 5, "Points");
    let options = this;
    let onChange = function(idx) {
	options.pointSize = idx;
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 5, this.pointSize, onChange);

    // Color function:
    let pointColor = function(options){return LDR.Colors.int2Hex(options.pointColor);};

    /* 
       Option 1: off
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-25 -25 50 50');
	svg.setAttribute('class', 'ui_toggles');
	svg.appendChild(LDR.SVG.makeOffIcon(0, 0, 50));
	buttons[0].appendChild(svg);
    }
    /*
      Options 2-5: Size 1-4:
    */
    for(let i = 1; i <= 4; i++) {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-25 -25 50 50');
	options.createSvgPoints(0, 0, pointColor, svg, i);	
	buttons[i].appendChild(svg);
    }
}

LDR.Options.appendAnimationOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 3, "Animations");
    let options = this;
    let onAnimationChange = function(idx) {
	options.showStepRotationAnimations = idx;
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 3, this.showStepRotationAnimations, onAnimationChange);
    let red = () => '#C91A09';
    let lineColor = () => LDR.Colors.int2Hex(options.lineColor);
    const w = 20;	
    
    /* 
       Option 1: Slow
    */
    {
	// Left box
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[0].appendChild(svg);
	this.createSvgBlock(-50, 0, true, red, lineColor, svg);

	// Circular arrow:
	let g1 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g1);
	LDR.SVG.appendRotationCircle(0, 0, 18, g1);

	// Right hand side:
	let g2 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g2);
	let turned = this.createSvgBlock(50, 0, true, red, lineColor, g2);

	let a = document.createElementNS(LDR.SVG.NS, 'animateTransform');
	a.setAttribute('id', 'turnerSlow');
	a.setAttribute('attributeName', 'transform');
	a.setAttribute('attributeType', 'XML');
	a.setAttribute('type', 'rotate');
	a.setAttribute('from', '0 50 0');
	a.setAttribute('to', '90 50 0');
	a.setAttribute('dur', '2s');
	a.setAttribute('fill', 'freeze');
	a.setAttribute('begin', '1s;turnerSlow.end+1s');

	g2.appendChild(a);
    }
    /* 
       Option 1: Normal speed
    */
    {
	// Left box
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[1].appendChild(svg);
	this.createSvgBlock(-50, 0, true, red, lineColor, svg);

	// Circular arrow:
	let g1 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g1);
	LDR.SVG.appendRotationCircle(0, 0, 18, g1);

	// Right hand side:
	let g2 = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g2);
	let turned = this.createSvgBlock(50, 0, true, red, lineColor, g2);

	let a = document.createElementNS(LDR.SVG.NS, 'animateTransform');
	a.setAttribute('id', 'turnerNormal');
	a.setAttribute('attributeName', 'transform');
	a.setAttribute('attributeType', 'XML');
	a.setAttribute('type', 'rotate');
	a.setAttribute('from', '0 50 0');
	a.setAttribute('to', '90 50 0');
	a.setAttribute('dur', '1s');
	a.setAttribute('fill', 'freeze');
	a.setAttribute('begin', '1s;turnerNormal.end+2s');

	g2.appendChild(a);
    }
    /* 
       Option 3: off
    */
    {
	// Left box
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -35 200 70');
	buttons[2].appendChild(svg);
	this.createSvgBlock(-50, 0, true, red, lineColor, svg);

	// Arrow:
	LDR.SVG.makeThinArrow(svg, w);

	// Right hand side:
	let g = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g);
	g.setAttribute('transform', 'rotate(90 0 0) translate(-50 -55)');
	let turned = this.createSvgBlock(50, 0, true, red, lineColor, g);
    }
}

LDR.Options.appendShowPLIOptions = function(optionsBlock) {
    console.warn('Show PLI option deprecated');
}

LDR.Options.appendLROptions = function(optionsBlock, ldrButtons) {
    console.warn('LR button option deprecated');
}

LDR.Options.appendCameraOptions = function(optionsBlock, ldrButtons) {
    console.warn('Camera options deprecated');
}

LDR.Options.appendRotationOptions = function(optionsBlock) {
    let group = this.addOptionsGroup(optionsBlock, 2, "Show FPS and Rotate");
    let options = this;
    let onChange = function(idx) {
	options.rotateModel = idx;
	options.onChange(false);
    };
    let buttons = this.createButtons(group, 2, this.rotateModel, onChange);
    let red = () => '#C91A09';
    let lineColor = () => LDR.Colors.int2Hex(options.lineColor);
    
    /* 
       Option 0: Off
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[0].appendChild(svg);
	this.createSvgBlock(0, 0, true, red, lineColor, svg);
    }
    /* 
       Option 1: On
    */
    {
	let svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-100 -25 200 50');
	buttons[1].appendChild(svg);

	let g = document.createElementNS(LDR.SVG.NS, 'g');
	svg.appendChild(g);
	let turned = this.createSvgBlock(0, 0, true, red, lineColor, g);

	let a = document.createElementNS(LDR.SVG.NS, 'animateTransform');
	a.setAttribute('id', 'turnerFull');
	a.setAttribute('attributeName', 'transform');
	a.setAttribute('attributeType', 'XML');
	a.setAttribute('type', 'rotate');
	a.setAttribute('from', '0 0 0');
	a.setAttribute('to', '360 0 0');
	a.setAttribute('dur', '30s');
	a.setAttribute('begin', '1s;turnerFull.end');

	g.appendChild(a);
    }
}

LDR.Options.appendStudHighContrastOptions = function(optionsBlock) {
    let self = this;
    let svg;

    let group = this.addTopOptionsGroup(optionsBlock);
    let onChange = function() {
	self.studHighContrast = self.studHighContrast === 0 ? 1 : 0; // Don't be clever here - lingering values can occur!
        self.onChange(true);
        updateSvg();
    };
    let button = this.createButton(group, onChange);

    let red = () => '#C91A09';
    let lineColor = () => LDR.Colors.int2Hex(options.lineColor);
    const W = 50;
    
    function updateSvg() {
        if(svg) {
            button.removeChild(svg);
        }
        svg = document.createElementNS(LDR.SVG.NS, 'svg');
        svg.setAttribute('viewBox', '-80 -25 160 50');
	button.appendChild(svg);

        self.createSvgCylinder(-W, 0, false, red, lineColor, svg);
	LDR.SVG.makeThinArrow(svg, W*0.4, true);
        self.createSvgCylinder(W, 0, true, red, lineColor, svg);
    }
    updateSvg();
}

LDR.Options.appendStudLogoOptions = function(optionsBlock) {
    let self = this;
    let svg;

    let group = this.addTopOptionsGroup(optionsBlock);
    let onChange = function() {
	self.studLogo = self.studLogo === 0 ? 1 : 0; // Don't be clever here - lingering values can occur!
	self.onChange(true);
        updateSvg();
    };
    let button = this.createButton(group, onChange);
    const W = 50;

    function updateSvg() {
        if(svg) {
            button.removeChild(svg);
        }	
        svg = document.createElementNS(LDR.SVG.NS, 'svg');
	svg.setAttribute('viewBox', '-80 -25 160 50');
	svg.setAttribute('class', 'ui_toggles');
	button.appendChild(svg);

	let circle = LDR.SVG.makeCircle(-W, 0, 23, true);
	circle.setAttribute('fill', '#C91A09');
        svg.append(circle);

	LDR.SVG.makeThinArrow(svg, W*0.4, true);

	circle = LDR.SVG.makeCircle(W, 0, 23, true);
	circle.setAttribute('fill', '#C91A09');
	svg.append(circle);

        let lego = document.createElementNS(LDR.SVG.NS, 'text');
        lego.innerHTML = 'LEGO';
        lego.setAttribute('class', 'lego_' + self.studLogo);
        lego.setAttribute('x', '32px');
        lego.setAttribute('y', '5px');
        svg.append(lego);
    }
    updateSvg();
}

LDR.Options.createButtons = function(parent, numberOfButtons, initiallySelected, onChange) {
    let ret = [];

    for(let i = 0; i < numberOfButtons; i++) {
	let button = document.createElement('td');
	button.setAttribute('class', i === initiallySelected ? 'option_selected' : 'option');
	let event = function(e) {
	    LDR.Options.setOptionsSelected(e.target, onChange);
	}
	button.addEventListener('click', event);
	ret.push(button);
	parent.appendChild(button);
    }

    return ret;
}

LDR.Options.createButton = function(parent, onChange) {
    let button = document.createElement('td');
    button.setAttribute('class', 'option');
    button.addEventListener('click', onChange);
    parent.appendChild(button);
    return button;
}

LDR.Options.addOptionsGroup = function(optionsBlock, columns, description) {
    let optionsTable = document.createElement('table');
    optionsTable.setAttribute('class', 'options');
    optionsBlock.appendChild(optionsTable);

    this.appendDescriptionBar(optionsTable, columns, description);

    let optionsGroupRow = document.createElement('tr');
    optionsGroupRow.setAttribute('class', 'options_group');
    optionsTable.appendChild(optionsGroupRow);

    return optionsGroupRow;
}

LDR.Options.addTopOptionsGroup = function(optionsBlock) {
    if(this.topOptionsGroup) {
        return this.topOptionsGroup;
    }
    let optionsTable = document.createElement('table');
    optionsTable.setAttribute('class', 'options');
    optionsBlock.appendChild(optionsTable);

    let optionsGroupRow = document.createElement('tr');
    optionsGroupRow.setAttribute('class', 'options_group');
    optionsTable.appendChild(optionsGroupRow);

    this.topOptionsGroup = optionsGroupRow;

    return optionsGroupRow;
}

/*
SVG Icon fun below:
*/
LDR.Options.svgBlockWidth = 30;
LDR.Options.svgBlockHeight = 25;

LDR.Options.createSvgBlock = function(x, y, closed, getFillColor, getLineColor, parent) {
    let dx2 = LDR.Options.svgBlockWidth/2; // Half a block width
    let dy = LDR.Options.svgBlockHeight;
    let dy2 = dy*0.3; // dy for moving half a block width.

    let pts1 = 'M ' + x + ' ' + (y - dy/2 + dy2) + 
	' l' + dx2 + ' -' + dy2 + 
	' v' + dy + 
	' l-' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' -' + dy2 + 
	' v-' + dy + 
	' l' + dx2 + ' ' + dy2 + 
	' v' + dy;
    let path1 = document.createElementNS(LDR.SVG.NS, 'path');
    path1.setAttribute('d', pts1);
    let options = this;
    let listener1 = function() {
	path1.setAttribute('fill', getFillColor(options));
	path1.setAttribute('stroke', getLineColor(options));
    };
    this.listeners.push(listener1);
    parent.appendChild(path1);
    listener1();

    if(!closed)
	return;

    let pts2 = 'M ' +(x-dx2) + ' ' + (y-dy/2) + 
	' l' + dx2 + ' -' + dy2 + 
	' l' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' ' + dy2 + 
	' Z';
    let path2 = document.createElementNS(LDR.SVG.NS, 'path');
    path2.setAttribute('d', pts2);
    let listener2 = function() {
	path2.setAttribute('fill', getFillColor(options));
	path2.setAttribute('stroke', getLineColor(options));
    }
    this.listeners.push(listener2);
    parent.appendChild(path2);
    listener2();
}

LDR.Options.createSvgPoints = function(x, y, getColor, parent, size) {
    let dx2 = LDR.Options.svgBlockWidth/2; // Half a block width
    let dy = LDR.Options.svgBlockHeight;
    let dy2 = dy*0.3; // dy for moving half a block width.

    let pts1 = 'M ' + x + ' ' + (y - dy/2 + dy2) + 
	' l' + dx2 + ' -' + dy2 + 
	' v' + dy + 
	' l-' + dx2 + ' ' + dy2 + 
	' l-' + dx2 + ' -' + dy2 + 
	' v-' + dy + 
	' l' + dx2 + ' ' + dy2 + 
	' v' + dy;
    let path1 = document.createElementNS(LDR.SVG.NS, 'path');
    path1.setAttribute('d', pts1);
    path1.setAttribute('stroke-dasharray', '0.1 5');
    path1.setAttribute('fill', 'none');
    path1.style = "stroke-width: " + size/2;
    let options = this;
    let listener1 = function() {
	path1.setAttribute('stroke', getColor(options));
    };
    this.listeners.push(listener1);
    parent.appendChild(path1);
    listener1();

    let pts2 = 'M ' +(x-dx2) + ' ' + (y-dy/2) + 
	' l' + dx2 + ' -' + dy2 + 
	' l' + dx2 + ' ' + dy2;
    let path2 = document.createElementNS(LDR.SVG.NS, 'path');
    path2.setAttribute('d', pts2);
    path2.setAttribute('stroke-dasharray', '0.1 5');
    path2.setAttribute('fill', 'none');
    path2.style = "stroke-width: " + size/2;
    let listener2 = function() {
	path2.setAttribute('stroke', getColor(options));
    }
    this.listeners.push(listener2);
    parent.appendChild(path2);
    listener2();
}

LDR.Options.createSvgCylinder = function(x, y, highContrast, getFillColor, getLineColor, parent) {
    let dx2 = LDR.Options.svgBlockWidth*0.5; // Half a block width
    let dy = LDR.Options.svgBlockHeight*0.5;
    let dy2 = dy*0.3; // dy for moving half a block width.

    function makeCyli(y) {
	let c = document.createElementNS(LDR.SVG.NS, 'ellipse');
	c.setAttribute('cx', x);
	c.setAttribute('cy', y);
	c.setAttribute('rx', dx2);
	c.setAttribute('ry', dy2);
	return c;
    }
    let base = makeCyli(y+dy/2);
    let center = LDR.SVG.makeRect(x-dx2, y-dy/2, LDR.Options.svgBlockWidth, dy);
    let top = makeCyli(y-dy/2);

    parent.appendChild(base);
    parent.appendChild(center);
    let l1 = LDR.SVG.makeLine(x-dx2, y-dy/2, x-dx2, y+dy/2);
    parent.appendChild(l1);
    let l2 = LDR.SVG.makeLine(x+dx2, y-dy/2, x+dx2, y+dy/2);	
    parent.appendChild(l2);	

    if(highContrast) {
        base.setAttribute('fill', '#000000');
        center.setAttribute('fill', '#000000');
        l1.setAttribute('stroke', '#000000');
        l2.setAttribute('stroke', '#000000');
    }
    parent.appendChild(top);

    let options = this;
    let listener = function() {
	base.setAttribute('stroke', getLineColor(options));
	if(!highContrast) {
	    l1.setAttribute('stroke', getLineColor(options));
	    l2.setAttribute('stroke', getLineColor(options));
            base.setAttribute('fill', getFillColor(options));
            center.setAttribute('fill', getFillColor(options));
        }
	top.setAttribute('fill', getFillColor(options));
	top.setAttribute('stroke', getLineColor(options));
    };
    this.listeners.push(listener);
    listener();
}
