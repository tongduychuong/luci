'use strict';
'require view';
'require fs';
'require ui';
'require uci';

/*
	button handling
*/
function handleAction(report, ev) {
	if (ev === 'search') {
		L.ui.showModal(_('IP Search'), [
			E('p', _('Search the banIP-related Sets for a specific IP.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'style': 'padding-top:.5em', 'id': 'run' }, [
					E('input', {
						'class': 'cbi-input-text',
						'placeholder': '192.168.0.1',
						'style': 'width:300px',
						'spellcheck': 'false',
						'id': 'search'
					})
				])
			]),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				'\xa0',
				E('h5', _('Result')),
				E('textarea', {
					'id': 'result',
					'style': 'width: 100% !important; padding: 5px; font-family: monospace',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': 20
				})
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						let ip = document.getElementById('search').value.trim().toLowerCase();
						if (ip) {
							document.getElementById('search').value = ip;
							document.getElementById('result').textContent = 'The search is running, please wait...';
							return L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['search', ip])).then(function (res) {
								let result = document.getElementById('result');
								result.textContent = res.trim();
								document.getElementById('search').value = '';
							})
						}
						document.getElementById('search').focus();
					})
				}, _('Search IP'))
			])
		]);
		document.getElementById('search').focus();
	}
	if (ev === 'content') {
		let content, selectOption, errMsg;

		if (report[1]) {
			try {
				content = JSON.parse(report[1]);
			} catch (e) {
				content = "";
				if (!errMsg) {
					errMsg = true;
					return ui.addNotification(null, E('p', _('Unable to parse the ruleset file!')), 'error');
				}
			}
		} else {
			return;
		}
		selectOption = [E('option', { value: '' }, [_('-- Set Selection --')])];
		Object.keys(content.nftables)
		.filter(key => content.nftables[key].set?.name && content.nftables[key].set.table === 'banIP')
		.sort((a, b) => content.nftables[a].set.name.localeCompare(content.nftables[b].set.name))
		.forEach(key => {
			selectOption.push(E('option', { 'value': content.nftables[key].set.name }, content.nftables[key].set.name));
		})
		L.ui.showModal(_('Set Content'), [
			E('p', _('List the elements of a specific banIP-related Set.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-select', 'style': 'padding-top:.5em', 'id': 'run' }, [
					E('h5', _('Set')),
					E('select', { 'class': 'cbi-input-select', 'id': 'set' },
						selectOption
					)
				]),
			]),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				'\xa0',
				E('h5', _('Result')),
				E('textarea', {
					'id': 'result',
					'style': 'width: 100% !important; padding: 5px; font-family: monospace',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': 20
				})
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						let set = document.getElementById('set').value;
						if (set) {
							document.getElementById('result').textContent = 'Collecting Set content, please wait...';
							return L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['content', set])).then(function (res) {
								let result = document.getElementById('result');
								result.textContent = res.trim();
								document.getElementById('set').value = '';
							})
						}
						document.getElementById('set').focus();
					})
				}, _('Show Content'))
			])
		]);
		document.getElementById('set').focus();
	}
	if (ev === 'map') {
		let md = L.ui.showModal(null, [
			E('div', { id: 'mapModal',
						style: 'position: relative;' }, [
				E('iframe', {
					id: 'mapFrame',
					src: L.resource('view/banip/map.html'),
					style: 'width: 100%; height: 80vh; border: none;'
				}),
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': function() {
						L.hideModal();
						sessionStorage.clear();
					}
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						let iframe = document.getElementById('mapFrame');
						iframe.contentWindow.location.reload();
					})
				}, _('Map Reset'))
			])
		]);
		md.style.maxWidth = '90%';
		document.getElementById('mapModal').focus();
	}
}

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['report', 'json']), ''),
			L.resolveDefault(fs.exec_direct('/usr/sbin/nft', ['-tj', 'list', 'sets']), ''),
			uci.load('banip')
		]);
	},

	render: function (report) {
		let content, rowSets, tblSets, notMsg, errMsg;

		if (report[0]) {
			try {
				content = JSON.parse(report[0]);
			} catch (e) {
				content = "";
				if (!errMsg) {
					errMsg = true;
					ui.addNotification(null, E('p', _('Unable to parse the report file!')), 'error');
				}
			}
		} else {
			content = "";
		}
		rowSets = [];
		tblSets = E('table', { 'class': 'table', 'id': 'sets' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Set')),
				E('th', { 'class': 'th right', 'style': 'padding-right: 20px' }, _('Count')),
				E('th', { 'class': 'th' }, _('Inbound&#160;(packets)')),
				E('th', { 'class': 'th' }, _('Outbound&#160;(packets)')),
				E('th', { 'class': 'th' }, _('Port&#160;/&#160;Protocol')),
				E('th', { 'class': 'th' }, _('Elements'))
			])
		]);

		if (content[0] && content[0].sets) {
			let cnt1, cnt2;

			Object.keys(content[0].sets).sort().forEach(function (key) {
				cnt1 = content[0].sets[key].cnt_inbound ? ': (' + content[0].sets[key].cnt_inbound + ')' : '';
				cnt2 = content[0].sets[key].cnt_outbound ? ': (' + content[0].sets[key].cnt_outbound + ')' : '';
				rowSets.push([
					E('em', key),
					E('em', { 'style': 'padding-right: 20px' }, content[0].sets[key].cnt_elements),
					E('em', content[0].sets[key].inbound + cnt1),
					E('em', content[0].sets[key].outbound + cnt2),
					E('em', content[0].sets[key].port),
					E('em', content[0].sets[key].set_elements.join(", "))	
				]);
			});
			rowSets.push([
				E('em', { 'style': 'font-weight: bold' }, content[0].sum_sets),
				E('em', { 'style': 'font-weight: bold; padding-right: 20px' }, content[0].sum_cntelements),
				E('em', { 'style': 'font-weight: bold' }, content[0].sum_setinbound + ' (' + content[0].sum_cntinbound + ')'),
				E('em', { 'style': 'font-weight: bold' }, content[0].sum_setoutbound + ' (' + content[0].sum_cntoutbound + ')'),
				E('em', { 'style': 'font-weight: bold' }, content[0].sum_setports),
				E('em', { 'style': 'font-weight: bold' }, content[0].sum_setelements)
			]);
		}
		cbi_update_table(tblSets, rowSets);

		return E('div', { 'class': 'cbi-map', 'id': 'cbimap' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('This report shows the latest NFT Set statistics, press the \'Refresh\' button to get a new one. \
					You can also display the specific content of Sets, search for suspicious IPs and finally, these IPs can also be displayed on a map.')),
				E('p', '\xa0'),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;width:230px;font-weight:bold;' }, _('Timestamp')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-bottom:-5px;color:#37c;font-weight:bold;' }, content?.[0]?.timestamp || '-')
				]),
				E('hr'),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;width:230px;font-weight:bold;' }, _('blocked syn-flood packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;color:#37c;font-weight:bold;' }, content?.[0]?.sum_synflood || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;width:230px;font-weight:bold;' }, _('blocked udp-flood packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;color:#37c;font-weight:bold;' }, content?.[0]?.sum_udpflood || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;width:230px;font-weight:bold;' }, _('blocked icmp-flood packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;color:#37c;font-weight:bold;' }, content?.[0]?.sum_icmpflood || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;width:230px;font-weight:bold;' }, _('blocked invalid ct packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;color:#37c;font-weight:bold;' }, content?.[0]?.sum_ctinvalid || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;width:230px;font-weight:bold;' }, _('blocked invalid tcp packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;color:#37c;font-weight:bold;' }, content?.[0]?.sum_tcpinvalid || '-')
				]),
				E('hr'),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;width:230px;font-weight:bold;' }, _('auto-added IPs to allowlist')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;color:#37c;font-weight:bold;' }, content?.[0]?.autoadd_allow || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;width:230px;font-weight:bold;' }, _('auto-added IPs to blocklist')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;color:#37c;font-weight:bold;' }, content?.[0]?.autoadd_block || '-')
				])
			]),
			E('br'),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'left' }, [
					E('h3', _('Set details')),
					tblSets
				])
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'click': ui.createHandlerFn(this, function () {
						if (uci.get('banip', 'global', 'ban_nftcount') !== '1' || uci.get('banip', 'global', 'ban_map') !== '1') {
							if (!notMsg) {
								notMsg = true;
								return ui.addNotification(null, E('p', _('GeoIP Map is not enabled!')), 'info');
							}
						}
						if (content[1] && content[1].length > 1) {
							sessionStorage.setItem('mapData', JSON.stringify(content[1]));
							return handleAction(report, 'map');
						}
						else {
							if (!notMsg) {
								notMsg = true;
								return ui.addNotification(null, E('p', _('No GeoIP Map data!')), 'info');
							}
						}
					})
				}, [_('Map...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'click': ui.createHandlerFn(this, function () {
						return handleAction(report, 'content');
					})
				}, [_('Set Content...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'click': ui.createHandlerFn(this, function () {
						return handleAction(report, 'search');
					})
				}, [_('IP Search...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none',
					'click': ui.createHandlerFn(this, function () {
						location.reload();
					})
				}, [_('Refresh')]),
			])
		]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
