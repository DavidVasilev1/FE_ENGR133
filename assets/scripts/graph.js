// start view var for element views
let startView;
// element view for final 
let endView;
// sets the mode of either editing or not
var editMode = 'edit';
// this is the path that is displayed
let pathMembersViews = [];
// for placing elements
let current_index = 0;
// id for showing the path
let nextId = 0;
// display variables
const pathMemberHighlightId = 'path-member';
const invalidPathHighlightId = 'invalid-path-member';
const pathMemberClassName = 'path-member';
const invalidPathClassName = 'invalid-path';
const highlightId = 'start-highlight';
const blueColor = '#54ccff';
const blackColor = '#222222';
const invalidColor = '#FF4365';
const outlineColor = '#616161';
// links between nodes
const links = {}
// size of nodes
const size = 40;
// starting views for the start and end nodes
const getStartView = () => startView;
const getEndView = () => endView;
// initializing joint graph
const graph = new joint.dia.Graph;
// making the element for the HTML
const paperElement = document.getElementById('interactive-graph');
// map array for adj array
var map_array = []
// initializing graph
var namespace = joint.shapes;

// toggling between edit and view mode
document.addEventListener("toggleMode", (event) => {
    // triggered by event passed from the html
    let mode = event.detail.mode;
    editMode = mode;
    // toggles type of mode with the view
    toggleView(editMode);
});

// clearing the map from event triggered by html
document.addEventListener("clearMap", (event) => {
    clearMap();
});

// styling for graph elements
const startAttrs = {
    padding: 2,
    attrs: {
        stroke: blueColor,
        'stroke-width': 2
    }
};

// more styling for links
const getTargetMarkerStyle = () => ({
    type: 'path',
    d: null,
    fill: blackColor,
    stroke: blackColor,
    tools: {
        linkTools: []
    }
});

// this is if the links are highlighted when displaying path
const getLinkStyle = () => {
    return V.createSVGStyle(`
    .joint-link .${pathMemberClassName} {
        stroke: #54ccff;
    }
`);
}

// this initializes the joint graph
const paper = new joint.dia.Paper({
    el: paperElement,
    width: 800,
    height: 650,
    gridSize: 1,
    model: graph,
    sorting: joint.dia.Paper.sorting.APPROX,
    defaultLink: () => new joint.shapes.standard.Link({
        attrs: {
            line: {
                targetMarker: getTargetMarkerStyle(),
                stroke: outlineColor
            }
        },
    }),
    defaultConnectionPoint: { name: 'boundary', args: { offset: 4 } },
    linkPinning: false,
    async: true,
    frozen: false,
    // allows for toggling of edit vs view modes
    interactive: () => {
        return editMode === "edit";
    },
    validateConnection: (cellViewS, _magnetS, cellViewT) => {
        const id = [cellViewS.model.id, cellViewT.model.id].sort().join();
        const existingLink = graph.getCell(id);
        const isSameCell = cellViewS.model.id === cellViewT.model.id;

        return !isSameCell && !existingLink && !cellViewT.model.isLink();
    },
    highlighting: {
        connecting: {
            name: 'mask',
            options: {
                padding: 2,
                attrs: {
                    stroke: blueColor,
                    'stroke-width': 2
                }
            }
        }
    }
});

// controller for graph to switch views
class Controller extends joint.mvc.Listener {
    get context() {
        const [ctx = null] = this.callbackArguments;
        return ctx;
    }
}

// this is the view controller which only allows certain inputs from the user
class ViewController extends Controller {
    startListening() {
        const { paper } = this.context;
        // these are the allowed inputs from the user (clicking, hovering)
        this.listenTo(paper, {
            'element:pointerdown': selectSource,
            'element:mouseenter': selectEnd,
            'element:mouseleave': hidePathOnMouseLeave,
        });
    }
}
// selecting the source node for display
function selectSource({ setStartView }, elementView) {
    setStartView(elementView);
}

// selecting the end view for the display of the path
function selectEnd({ showPath, setEndView, getStartView, getEndView }, elementView) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();

    // highlighting the path
    if (elementView === pathStartView) return;
    if (pathStartView && pathEndView) {
        joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
        joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);
    }
    setEndView(elementView);
    // showing the path
    showPath();
}

// hiding the path when the mouse leaves to node
function hidePathOnMouseLeave({ hidePath, getStartView, getEndView, setEndView }) {
    const pathStartView = getStartView();
    const pathEndView = getEndView();

    // hiding the path
    hidePath();
    // removing the highlighted elements
    if (pathStartView) joint.highlighters.addClass.remove(pathStartView, invalidPathHighlightId);
    if (pathEndView) joint.highlighters.addClass.remove(pathEndView, invalidPathHighlightId);
    setEndView(null);
}

// this is what inputs are allowed for editing
class EditController extends Controller {
    startListening() {
        const { graph, paper } = this.context;
        // we have a way to add links here
        this.listenTo(graph, {
            'change:source': replaceLink,
            'change:target': replaceLink,
        });
        // here is how to add and remove nodes
        this.listenTo(paper, {
            'element:mouseenter': showElementTools,
            'element:mouseleave': hideElementTools,
            'element:pointerdblclick': removeElement,
            'blank:pointerdblclick': addElement
        });
    }
}
// this shows elements tools, we don't use this because we don't remove links
function showElementTools(_context, elementView, _evt) {
    elementView.showTools();
}
// this is the same as above but to high the tools, we don't use this
function hideElementTools(_context, elementView) {
    elementView.hideTools();
}

// this is used to replace links, so that if a node is deleted with links, the links are deleted
function replaceLink({ createLink }, link, _collection, opt) {
    // identifies source and target
    const sourceId = link.get('source').id;
    const targetId = link.get('target').id;
    // this removes a link
    if (opt.ui && sourceId && targetId) {
        createLink(sourceId, targetId);
        link.remove();
    }
}

// this is used to remove nodes
function removeElement({ setStartView, setEndView, getStartView }, elementView) {
    const pathStart = getStartView();

    // setting the start and end views as null just to remove the teh possibility of that node being selected as a start or end node
    if (pathStart && pathStart.model) {
        if (elementView.model.id === pathStart.model.id) {
            setStartView(null);
            setEndView(null);
        }
    } else {
        // checking is this is a valid path
        console.warn("pathStart is undefined or does not have a model");
    }
    // if the element is there
    if (elementView && elementView.model) {
        const modelId = elementView.model.id;

        // editing the map array for saving the map
        if (Array.isArray(map_array)) {
            // get the point index
            const pointIndexInMap = map_array.findIndex(point => point.id === modelId);
            if (pointIndexInMap !== -1) {
                // set the map coords as n/a because the node doesn't exist
                // we don't delete because that messes up the indexing for the loading of the map
                map_array[pointIndexInMap].x = "n/a";
                map_array[pointIndexInMap].y = "n/a";

                // this goes through each node, making sure they exist
                map_array.forEach(node => {
                    if (node.end && Array.isArray(node.end)) {
                        const endIndex = node.end.indexOf(modelId);
                        if (endIndex !== -1) {
                            // if they don't exist, remove them
                            node.end.splice(endIndex, 1);
                        }
                    }
                });
                // this removes nodes from the adjacency list, for path-finding calculations
                if (Array.isArray(adj_array)) {
                    // finds node and removes it
                    adj_array = adj_array.filter(edge => edge[0] !== modelId && edge[1] !== modelId);
                } else {
                    console.error("adj_array is undefined or not an array");
                }
            } else {
                console.warn("Point not found in map_array");
            }
        } else {
            console.error("map_array is undefined or not an array");
        }

        elementView.model.remove();
    } else {
        console.warn("Cannot remove element: elementView or elementView.model is undefined");
    }
}

// adding an element to the map
function addElement({ createNode, size }, _evt, x, y) {
    // this defines what a node is
    const node = createNode(getNodeId(), x - size / 2, y - size / 2);
    // gives the node it's position
    node.position(x - size / 2, y - size / 2);
    // add it to the node array
    nodes_array.push(node);
    // add it to the map array so that we can save the map
    map_array.push({
        id: node.id,
        x: node.attributes.position.x,
        y: node.attributes.position.y
    });

}

// this is for changing the position of the node
graph.on('change:position', function (cell) {
    if (cell.isElement()) {
        // this gets the node id
        const nodeId = cell.id;
        const center = cell.getBBox().center();
        // gets node coordinates
        node_coords[nodeId] = center;
        // fins the node in the map
        const nodeInMap = map_array.find(node => node.id === nodeId);
        if (nodeInMap) {
            // change the coords to the new ones when it is moved
            nodeInMap.x = center.x;
            nodeInMap.y = center.y;
        }
        // finds the node in the adj array
        adj_array.forEach(connection => {
            // gets the link
            const [sId, tId, oldDistance] = connection;
            if (sId === nodeId || tId === nodeId) {
                // gets the source and target
                const source = getNodefromId(sId);
                const target = getNodefromId(tId);
                // if the source and target exist
                if (source && target) {
                    // update the x, y coords
                    const newX1 = source.attributes.position.x;
                    const newX2 = target.attributes.position.x;
                    const newY1 = source.attributes.position.y;
                    const newY2 = target.attributes.position.y;
                    // calculate a new distance
                    const newDistance = Math.sqrt((newX1 - newX2) ** 2 + (newY1 - newY2) ** 2) * (20 / Math.sqrt(400 ** 2 + 800 ** 2));
                    // te the new connection
                    connection[2] = newDistance;
                }
            }
        });

    }
});

// these are the controllers for the viewing vs th editing
// these contain the functions necessary to run the program properly
const viewController = new ViewController({ paper, showPath, hidePath, setStartView, setEndView, getStartView, getEndView });
const editController = new EditController({ graph, paper, createLink, createNode, setStartView, setEndView, getStartView, size });

// for the edit controller, we need to start the listener to edit
editController.startListening();
// getting the current id
function getCurrentID() {
    return current_index;
}
// getting the node id
function getNodeId() {
    current_index++;
    return current_index;
}
// getting the node from an id
function getNodefromId(id) {
    // this is used to find nodes we need in some cases
    for (let i = 0; i < nodes_array.length; i++) {
        if (nodes_array[i].id == id) {
            return nodes_array[i];
        }
    }
}

// this creates a new node
function createNode(id) {
    // we define what a node is
    var node = new joint.shapes.standard.Circle({
        id,
        size: { width: 40, height: 40 },
        attrs: {
            body: {
                fill: 'black'
            },
            label: {
                fill: 'white'
            }
        }
    }).addTo(graph);
    // we add it to the graph
    var view = node.findView(paper);
    // we add the tools view for it, such as the little icon to show the connection
    view.addTools(new joint.dia.ToolsView({
        tools: [
            new joint.elementTools.HoverConnect({
                useModelGeometery: true,
                trackPath: V.convertCircleToPathData(joint.V(`<circle cx="${40 / 2}" cy="${40 / 2}" r="${40 / 2}" />`))
            }),
        ]
    }))
    // hide the tools when not using the node
    view.hideTools();
    // label with the id
    node.attr('label/text', id);
    return node;
}

// creating a link
function createLink(s, t) {
    // makes sure that the nodes that the link is connected to actually exist
    if (!getNodefromId(s) || !getNodefromId(s).attributes || !getNodefromId(t) || !getNodefromId(t).attributes) {
        console.warn(`Cannot create link. Source or target node is invalid or missing attributes. Source: ${s}, Target: ${t}`);
        return;
    }
    // this gets the positions of the nodes
    let x1 = getNodefromId(s).attributes.position.x;
    let x2 = getNodefromId(t).attributes.position.x;
    let y1 = getNodefromId(s).attributes.position.y;
    let y2 = getNodefromId(t).attributes.position.y;

    // if the coordinates are n/a, we skip the link
    // this is only used when regenerating the graph
    if (x1 === "n/a" || y1 === "n/a" || x2 === "n/a" || y2 === "n/a") {
        console.warn(`Cannot create link. One or more coordinates are invalid (n/a). Source: ${s}, Target: ${t}`);
        return;
    }
    // we get the link id from the source and target
    var linkId = [s, t].sort().join();
    // define what a link is
    var link = new joint.shapes.standard.Link({
        id: linkId,
        source: { id: s },
        target: { id: t },
        z: 1,
        distance: Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2) * (20 / Math.sqrt(400 ** 2 + 800 ** 2)),
        attrs: {
            label: {
                pointerEvents: 'auto'
            },
            body: {
                pointerEvents: 'none'
            },
            wrapper: {
                stroke: 'white',
                'stroke-width': 6
            },
            line: { targetMarker: getTargetMarkerStyle(), stroke: outlineColor }
        },
    });
    // add the link to the links array
    links[linkId] = link;
    // this is how we get the data we need for the adjacency list
    if (link.attributes.target.hasOwnProperty("id")) {
        const sId = link.attributes.source.id;
        const tId = link.attributes.target.id;
        const distance = link.attributes.distance;
        // we get the link connection id
        const maxId = Math.max(sId, tId);
        // we create an array full of infinite values
        while (adj_List.length < maxId) {
            adj_List.push(Array(maxId).fill(10000));
        }
        // we push the source, target, and distance
        adj_array.push([sId, tId, distance]);
        // this is the source and target nodes for connections
        const sourceNode = map_array.find(node => node.id === sId);
        const targetNode = map_array.find(node => node.id === tId);
        // this is used for the source and target nodes for creating the link
        if (sourceNode) {
            if (!Array.isArray(sourceNode.end)) {
                sourceNode.end = [];
            }
            if (!sourceNode.end.includes(tId)) {
                sourceNode.end.push(tId);
            }
        } else {
            console.warn(`Node ${sId} not found in map_array`);
        }

    }
    // create the link
    link.addTo(graph);

    var view = link.findView(paper);
    view.addTools(new joint.dia.ToolsView({
        tools: []
    }));
    // add the link to the edge array
    edge_array.push(link);
    view.hideTools();
}

// setting the start view
function setStartView(elementView) {
    // hide the path
    hidePath();
    // remove the highlights
    if (startView) {
        joint.highlighters.mask.remove(startView, highlightId);
        joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
    }
    // remove the invalid path
    if (endView) {
        joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
    }
    // highlight the path by changing the color of each element
    if (elementView) {
        joint.highlighters.mask.add(elementView, 'body', highlightId, startAttrs);
    }
    // setting the start view
    startView = elementView;
    start.length = 0
    start.push(elementView.model.id)
}

// setting the ending view
function setEndView(elementView) {
    // this sets the end node
    endView = elementView
    end.length = 0
    end.push(elementView.model.id)
}

// this gets the path of the element
function getElementPath() {
    // we get the adj list
    adj_List = Array.from({ length: current_index }, () => Array(current_index).fill(10000));

    // for each element in the list
    for (let i = 0; i < adj_array.length; i++) {
        // we get the path from one node to another
        const [fromNode, toNode, weight] = adj_array[i];
        // checking for invalid edges
        if (fromNode < 0 || fromNode >= current_index + 1 || toNode < 0 || toNode >= current_index + 1) {
            console.error(`Invalid edge in adj_array: ${adj_array[i]}. Current index: ${current_index}`);
            continue;
        }
        // we look through the adj list and place the weights, this works for bidirectional graphs
        adj_List[fromNode - 1][toNode - 1] = weight;
        adj_List[toNode - 1][fromNode - 1] = weight;
    }
    // getting the adj list and setting the path from one node to itself to 0
    for (let i = 0; i < current_index; i++) {
        adj_List[i][i] = 0;
    }

    // this is the payload to the backend server
    const payload = {
        adjacencyList: adj_List,
        source: parseInt(start),
        target: parseInt(end)
    };
    
    console.log("Payload sent to backend: ", payload)
    // this is the backend URL
    const backendURL = 'http://127.0.0.1:8199/api/dijkstra';
    // opens a request to the backend
    const xhr = new XMLHttpRequest();
    // this is a post to the backend
    xhr.open('POST', backendURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    // works on the basis of a promise, using async functions to make sure that everything is executed in the proper time
    return new Promise((resolve, reject) => {
        xhr.onload = function () {
            // if we receive a 200 error
            if (xhr.status >= 200 && xhr.status < 300) {
                // get the response from the server, which is the path in this case
                const response = JSON.parse(xhr.responseText);
                console.log("Response recieved from server", response)
                // resolve the promise, continue with plotting the pathway
                resolve(response)
            } else {
                console.error('Request failed with status:', xhr.status);
            }
        };

        xhr.onerror = function () {
            console.error('Request failed');
        };
        // sending the json
        xhr.send(JSON.stringify(payload));
    });
}
// this is for saving a map
function saveMap(map_Name) {
    // this is the payload for the backend
    const payload = {
        map: map_array,
        mapName: map_Name
    };  
        
    console.log("Saving Map: ", payload)

    const backendURL = 'http://127.0.0.1:8199/api/map';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', backendURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    // again use promises for timing
    return new Promise((resolve, reject) => {
        xhr.onload = function () {

            if (xhr.status >= 200 && xhr.status < 300) {
                const response = JSON.parse(xhr.responseText);
                // loads the maps again to make sure they are all shown in the list
                loadMaps()
                console.log("Response from server for saving: ", response)
                // resolving the promise with a response that shows if the map was saved properly
                resolve(response)
            } else {
                console.error('Request failed with status:', xhr.status);
            }
        };

        xhr.onerror = function () {
            console.error('Request failed');
        };

        xhr.send(JSON.stringify(payload));
    });
}
// this gets all maps from the backend
function getMaps() {
    const backendURL = 'http://127.0.0.1:8199/api/getMaps';

    const xhr = new XMLHttpRequest();
    xhr.open('GET', backendURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    return new Promise((resolve, reject) => {
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                const response = JSON.parse(xhr.responseText);
                console.log("response recieved from server for loading maps: ", response)
                // this resolve contains a structure of all the maps compiled into one
                resolve(response);
            } else {
                console.error('Request failed with status:', xhr.status);
                reject(new Error(`Request failed with status ${xhr.status}`));
            }
        };

        xhr.onerror = function () {
            console.error('Request failed');
            reject(new Error('Request failed'));
        };

        xhr.send();
    });
}


// this gets the link path
function getLinkPath(elementPath) {
    const linkPath = [];

    if (startView) {
        for (let i = 0; i < elementPath.length - 1; i++) {
            const sourceId = elementPath[i];
            const targetId = elementPath[i + 1];
            const link = graph.getCell([sourceId, targetId].sort().join());
            if (!link) continue;

            linkPath.push(link.id);
        }
    }

    return linkPath;
}

async function showPath() {

    const elementPath = await getElementPath();
    const isPathFound = elementPath.length > 0;
    if (!isPathFound && startView && endView && startView.id !== endView.id && !editMode) {
        joint.highlighters.addClass.add(startView, 'body', invalidPathHighlightId, {
            className: invalidPathClassName
        });
        joint.highlighters.addClass.add(endView, 'body', invalidPathHighlightId, {
            className: invalidPathClassName
        });
        hidePath();
        return;
    }

    if (startView) joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
    if (endView) joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
    hidePath();
    const linkPath = getLinkPath(elementPath);

    for (const elementId of [...elementPath, ...linkPath]) {
        const element = graph.getCell(elementId);
        const view = element.findView(paper);
        const isLink = view.model.isLink();
        joint.highlighters.addClass.add(view, isLink ? 'line' : 'body', pathMemberHighlightId, {
            className: pathMemberClassName
        });

        if (isLink) {
            element.set('z', 2);
        }

        pathMembersViews.push(view);
    }
}

function hidePath() {
    for (const view of pathMembersViews) {
        const model = view.model;
        joint.highlighters.addClass.remove(view, pathMemberHighlightId);

        if (model.isLink()) {
            model.set('z', 1);
            model.labels([]);
        }
    }

    pathMembersViews = [];
}

function toggleLinkStyle() {
    if (linkStyle) paper.svg.removeChild(linkStyle);

    linkStyle = getLinkStyle();
    paper.svg.prepend(linkStyle);
}

const styles = V.createSVGStyle(`
    .joint-element .${pathMemberClassName} {
        stroke: ${blueColor};
        fill: ${blueColor};
        fill-opacity: 0.75;
    }
    .joint-element .${invalidPathClassName} {
        stroke: ${invalidColor};
        fill: ${invalidColor};
        fill-opacity: 0.2;
    }
    @keyframes dash {
        to {
            stroke-dashoffset: 0;
        }
    }
    @keyframes stroke {
        to {
            stroke: ${blueColor};
        }
    }
`);

let linkStyle = getLinkStyle();

paper.svg.prepend(styles);
paper.svg.prepend(linkStyle);

var zoomLevel = 1;

document.getElementById('zoom-in').addEventListener('click', function () {
    zoomLevel = Math.min(3, zoomLevel + 0.2);
    var size = paper.getComputedSize();
    paper.translate(0, 0);
    paper.scale(zoomLevel, zoomLevel, size.width / 2, size.height / 2);
});

document.getElementById('zoom-out').addEventListener('click', function () {
    zoomLevel = Math.max(0.2, zoomLevel - 0.2);
    var size = paper.getComputedSize();
    paper.translate(0, 0);
    paper.scale(zoomLevel, zoomLevel, size.width / 2, size.height / 2);
});



function toggleView(editMode) {
    for (const element of graph.getElements()) {
        if (editMode == "edit") {
            element.attr('body/cursor', 'move');
        } else if (editMode == "view") {
            element.attr('body/cursor', 'pointer');
        }
    }

    if (editMode == "edit") {
        viewController.stopListening();
        editController.startListening();
        hidePath();
        if (startView) {
            joint.highlighters.mask.remove(startView, highlightId);
            joint.highlighters.addClass.remove(startView, invalidPathHighlightId);
        }
        if (endView) {
            joint.highlighters.addClass.remove(endView, invalidPathHighlightId);
        }
    } else if (editMode == "view") {
        viewController.startListening();
        editController.stopListening();
        showPath();
        if (startView) {
            joint.highlighters.mask.add(startView, 'body', highlightId, startAttrs);
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {

    const mapNameInput = document.getElementById('mapName');

    document.getElementById('saveMap').addEventListener('click', function () {
        const mapName = mapNameInput.value;

        saveMap(mapName);

        mapNameInput.value = '';
    });
});

window.onload = function () {
    loadMaps()
};

function loadMaps() {
    getMaps()
        .then((maps) => populateTable(maps))
        .catch((error) => console.error('Error loading maps:', error));
}

function populateTable(maps) {
    const tableBody = document.getElementById('table-body');
    tableBody.innerHTML = '';

    function updateLoadButtonsState() {
        const hasElementsOnMap = graph.getElements().length > 0 || graph.getLinks().length > 0;
        const loadButtons = document.querySelectorAll('.btn-load-map');
        loadButtons.forEach(button => {
            if (hasElementsOnMap) {
                button.classList.add('btn-disabled');
                button.disabled = true;
            } else {
                button.classList.remove('btn-disabled');
                button.disabled = false;
            }
        });
    }

    maps.forEach((map, index) => {
        const row = document.createElement('tr');

        const mapNameCell = document.createElement('td');
        const mapNameButton = document.createElement('button');
        mapNameButton.className = 'btn btn-neutral';
        mapNameButton.textContent = map.mapName;
        mapNameCell.appendChild(mapNameButton);
        row.appendChild(mapNameCell);

        const loadCell = document.createElement('td');
        const loadButton = document.createElement('button');
        loadButton.className = 'btn btn-outline btn-info btn-load-map';
        loadButton.textContent = 'Load';
        loadButton.addEventListener('click', () => {
            if (!loadButton.classList.contains('btn-disabled')) {
                loadMap(map);
                updateLoadButtonsState();
            }
        });
        loadCell.appendChild(loadButton);
        row.appendChild(loadCell);

        const deleteCell = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-outline btn-error';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteMap(map.id));
        deleteCell.appendChild(deleteButton);
        row.appendChild(deleteCell);

        tableBody.appendChild(row);
    });

    graph.on('change', updateLoadButtonsState);
    graph.on('clear', () => {
        const loadButtons = document.querySelectorAll('.btn-load-map');
        loadButtons.forEach(button => {
            button.classList.remove('btn-disabled');
            button.disabled = false;
        });
    });

    updateLoadButtonsState();
}

function loadMap(map) {
    console.log(map);
    current_index = 0;
    const nodesData = JSON.parse(map.nodeMap);

    graph.clear();
    map_array = [];

    nodesData.forEach(nodeData => {
        const { id, x, y, end } = nodeData;

        if (x === "n/a" || y === "n/a") {
            console.warn(`Skipping node with id ${id} due to invalid coordinates.`);
            current_index++
            return;
        }

        addElement({ createNode, size: 40 }, null, x, y);

        map_array.push({ id, x, y, end });
    });

    nodesData.forEach(nodeData => {
        const { id, end } = nodeData;
        if (end && Array.isArray(end)) {
            end.forEach(targetId => {
                createLink(id, targetId);
            });
        }
    });
}

function deleteMap(mapId) {
    const backendURL = `http://127.0.0.1:8199/api/deleteMap/${mapId}`;
    const xhr = new XMLHttpRequest();
    xhr.open('DELETE', backendURL, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            loadMaps();
        } else {
            console.error('Failed to delete map:', xhr.status);
        }
    };

    xhr.onerror = function () {
        console.error('Request failed');
    };

    xhr.send();
}

function clearMap() {
    graph.clear()
    current_index = 0;
    window.location.reload();
}