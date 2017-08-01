///////////////////////////////////////////////////////////
// DataManagement Viewer Extension
// By Philippe Leefsma, Autodesk Inc, July 2017
//
///////////////////////////////////////////////////////////
import MultiModelExtensionBase from 'Viewer.MultiModelExtensionBase'
import DerivativesAPI from './Derivatives.API'
import WidgetContainer from 'WidgetContainer'
import { browserHistory } from 'react-router'
import { Tabs, Tab } from 'react-bootstrap'
import DataTreeView from './DataTreeView'
import ServiceManager from 'SvcManager'
import { ReactLoader } from 'Loader'
import Measure from 'react-measure'
import DOMPurify from 'dompurify'
import ReactDOM from 'react-dom'
import DMAPI from './DM.API'
import Label from 'Label'
import React from 'react'

class DataManagementExtension extends MultiModelExtensionBase {

  /////////////////////////////////////////////////////////
	// Class constructor
  //
  /////////////////////////////////////////////////////////
	constructor (viewer, options) {

		super (viewer, options)

    this.onItemNodeCreated = this.onItemNodeCreated.bind(this)
    this.onTabSelected = this.onTabSelected.bind(this)
    this.onLoadItem = this.onLoadItem.bind(this)

    this.dialogSvc =
      ServiceManager.getService(
        'DialogSvc')

    this.forgeSvc =
      ServiceManager.getService(
        'ForgeSvc')

    this.derivativesAPI = new DerivativesAPI({
      apiUrl: '/api/derivatives/3legged'
    })

    this.dmAPI = new DMAPI({
      apiUrl: '/api/dm'
    })

    this.react = options.react
	}

	/////////////////////////////////////////////////////////
	// Load callback
  //
  /////////////////////////////////////////////////////////
	load () {

    if (!this.viewer.model) {

      this.viewer.container.classList.add('empty')
    }

    this.react.setState({

      user: this.options.appState.user,
      activeTabKey: null,
      showTitle: false,
      hubs: null,
      width: 0

    }).then (async() => {

      await this.react.pushRenderExtension(this)

      if (!this.options.appState.user) {

        try {

          const user = await this.forgeSvc.getUser()

          this.react.setState({
            user
          })

        } catch (ex) {

          return this.showLogin()
        }
      }

      this.options.loader.show(false)

      const hubsRes = await this.dmAPI.getHubs()

      this.react.setState({
        hubs: hubsRes.data
      })
    })

    this.viewer.loadDynamicExtension(
      'Viewing.Extension.ContextMenu').then(
        (ctxMenuExtension) => {

          ctxMenuExtension.addHandler(
            this.onContextMenu)
        })

    console.log('Viewing.Extension.DataManagement loaded')

		return true
	}

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  get className() {

    return 'data-management'
  }

  /////////////////////////////////////////////////////////
	// Extension Id
  //
  /////////////////////////////////////////////////////////
	static get ExtensionId () {

		return 'Viewing.Extension.DataManagement'
	}

  /////////////////////////////////////////////////////////
	// Unload callback
  //
  /////////////////////////////////////////////////////////
	unload () {

    console.log('Viewing.Extension.DataManagement loaded')

    super.unload ()

		return true
	}

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async onItemNodeCreated (node) {

    const versionsRes =
      await this.dmAPI.getItemVersions(
        node.props.projectId, node.props.itemId)

    node.versions = versionsRes.data

    if (node.versions.length) {

      node.activeVersion = node.versions[0]

      const urn = this.dmAPI.getVersionURN(
        node.activeVersion)

      const manifest =
        await this.derivativesAPI.getManifest(urn)

      if (this.derivativesAPI.hasDerivative (
          manifest, { type: 'geometry'})) {

        node.setViewerUrn(urn)
      }

      const thumbnail =
        await this.derivativesAPI.getThumbnail(urn, {
          size: 200, base64: true
        })

      node.setThumbnail(`data:image/png;base64,${thumbnail}`)

      node.showLoader(false)
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async onLoadItem (node) {

    const extId = 'Viewing.Extension.ModelLoader'

    const loader = this.viewer.getExtension(extId)

    const version = node.activeVersion

    node.showLoader(true)

    await loader.loadModel({
      fileType: version.attributes.fileType,
      name: node.props.name.split('.')[0],
      _id : this.options.dbModel._id,
      env: 'AutodeskProduction',
      database: 'configurator',
      model: {
        proxy: 'lmv-proxy-3legged',
        urn: node.viewerUrn
      }
    })

    node.showLoader(false)
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  async setDocking (docked) {

    const id = DataManagementExtension.ExtensionId

    if (docked) {

      await this.react.popRenderExtension(id)

      this.react.pushViewerPanel(this, {
        height: 250,
        width: 350
      })

    } else {

      await this.react.popViewerPanel(id)

      this.react.pushRenderExtension(this)
    }
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  showLogin () {

    const onClose = (result) => {

      this.dialogSvc.off('dialog.close', onClose)

      if (result === 'OK') {

        this.forgeSvc.login()
        return
      }

      browserHistory.push('/configurator')
    }

    this.dialogSvc.on('dialog.close', onClose)

    this.dialogSvc.setState({
      onRequestClose: () => {},
      className: 'login-dlg',
      title: 'Forge Login required ...',
      content:
        <div>
          Press OK to login ...
        </div>,
      open: true
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderTitle (docked) {

    const spanClass = docked
      ? 'fa fa-chain-broken'
      : 'fa fa-chain'

    return (
      <div className="title">
        <label>
          Data Management
        </label>
        <div className="data-management-controls">
          <button onClick={() => this.setDocking(docked)}
            title="Toggle docking mode">
            <span className={spanClass}/>
          </button>
        </div>
      </div>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  onTabSelected (tabKey) {

    this.react.setState({
      activeTabKey: tabKey
    })
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderHubs (hubs) {

    const state = this.react.getState()

    const tabs = hubs.map((hub) => {

      const hubHeader = this.dmAPI.getHubHeader(hub)


      const style = {
        width:
          `${Math.floor((state.width-6)/hubs.length-14)}px`
      }

      const title =
        <label style={style}>
          {`${hubHeader}: ${hub.attributes.name}`}
        </label>

      return (
        <Tab className="tab-container"
          eventKey={hub.id}
          title={title}
          key={hub.id}>
          <DataTreeView
            onItemNodeCreated={this.onItemNodeCreated}
            menuContainer={this.options.appContainer}
            onLoadItem={this.onLoadItem}
            api={this.dmAPI}
            hub={hub}
          />
        </Tab>
      )
    })

    const activeTabKey = state.activeTabKey || hubs[0].id

    return (
      <Measure bounds onResize={(rect) => {
        this.react.setState({ width: rect.bounds.width })
      }}>
        {
          ({ measureRef }) =>
          <div ref={measureRef} className="tabs-container">
            <Tabs onSelect={this.onTabSelected}
              activeKey={activeTabKey}
              className="tabs"
              id="hubs-tab">
              { tabs }
            </Tabs>
          </div>
        }
      </Measure>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  renderContent () {

    const {hubs} = this.react.getState()

    const showLoader = !hubs

    return (
      <div className="content">
        <ReactLoader show={showLoader}/>
        { hubs && hubs.length && this.renderHubs(hubs) }
      </div>
    )
  }

  /////////////////////////////////////////////////////////
  //
  //
  /////////////////////////////////////////////////////////
  render (opts) {

    const {showTitle} = this.react.getState()

    return (
      <WidgetContainer
        renderTitle={() => this.renderTitle(opts.docked)}
        className={this.className}
        showTitle={showTitle}>

        { this.renderContent () }

      </WidgetContainer>
    )
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension (
  DataManagementExtension.ExtensionId,
  DataManagementExtension)

export default 'Viewing.Extension.DataManagement'
