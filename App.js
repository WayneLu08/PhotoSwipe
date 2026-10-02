import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  Dimensions,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  StatusBar,
  SafeAreaView
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import {
  PanGestureHandler,
  GestureHandlerRootView,
  State
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 90;

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);

  // 动画 Shared Values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted');
      if (status === 'granted') {
        loadPhotos();
        loadAlbums();
      }
    })();
  }, []);

  // 加载手机相册照片
  const loadPhotos = async () => {
    try {
      const assets = await MediaLibrary.getAssetsAsync({
        first: 150,
        mediaType: 'photo',
        sortBy: [MediaLibrary.SortBy.creationTime]
      });
      setPhotos(assets.assets || []);
    } catch (e) {
      console.log('读取相册失败:', e);
    }
  };

  // 加载手机相册列表
  const loadAlbums = async () => {
    try {
      const userAlbums = await MediaLibrary.getAlbumsAsync();
      setAlbums(userAlbums || []);
    } catch (e) {
      console.log('读取相册列表失败:', e);
    }
  };

  // 触觉震动反馈
  const triggerHaptic = (type) => {
    if (type === 'delete') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // 执行动作
  const handleAction = async (action, targetAlbum = null) => {
    if (currentIndex >= photos.length) return;
    const currentPhoto = photos[currentIndex];

    // 记录历史供撤销
    setHistory(prev => [...prev, { photo: currentPhoto, action, album: targetAlbum, index: currentIndex }]);

    if (action === 'delete') {
      triggerHaptic('delete');
    } else if (action === 'like') {
      triggerHaptic('like');
    } else if (action === 'album' && targetAlbum) {
      triggerHaptic('album');
      try {
        await MediaLibrary.addAssetsToAlbumAsync([currentPhoto], targetAlbum, false);
      } catch (e) {
        console.log('添加相册失败:', e);
      }
    } else if (action === 'keep') {
      triggerHaptic('keep');
    }

    translateX.value = 0;
    translateY.value = 0;
    setCurrentIndex(prev => prev + 1);
  };

  // 撤销上一步
  const handleUndo = () => {
    if (history.length === 0 || currentIndex === 0) {
      Alert.alert('提示', '当前没有可撤销的操作哦 🐱');
      return;
    }
    setHistory(prev => prev.slice(0, -1));
    setCurrentIndex(prev => prev - 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // 手势结束判断方向
  const onGestureEnd = (dx, dy) => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absY > absX && absY > SWIPE_THRESHOLD) {
      if (dy < -SWIPE_THRESHOLD) {
        // ⬆ 上滑：喜欢
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 250 }, () => {
          runOnJS(handleAction)('like');
        });
      } else {
        // ⬇ 下滑：收纳相册
        setPendingPhoto(photos[currentIndex]);
        setModalVisible(true);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    } else if (absX > SWIPE_THRESHOLD) {
      if (dx < -SWIPE_THRESHOLD) {
        // ⬅ 左滑：删除
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(handleAction)('delete');
        });
      } else {
        // ➡ 右滑：保留
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
          runOnJS(handleAction)('keep');
        });
      }
    } else {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  };

  // 卡片主体动画
  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = `${(translateX.value / SCREEN_WIDTH) * 18}deg`;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: rotate }
      ]
    };
  });

  // 动态印章徽章样式（随滑动位移渐现）
  const likeBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-100, -30, 0], [1, 0.4, 0], Extrapolation.CLAMP)
  }));
  const albumBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, 30, 100], [0, 0.4, 1], Extrapolation.CLAMP)
  }));
  const deleteBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-100, -30, 0], [1, 0.4, 0], Extrapolation.CLAMP)
  }));
  const keepBadgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 30, 100], [0, 0.4, 1], Extrapolation.CLAMP)
  }));

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionTitle}>🌿 需要相册权限</Text>
        <Text style={styles.permissionText}>PhotoSwipe 需要相册读写权限才能帮您智能分类整理照片哦 🐱</Text>
      </View>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F4F8F6" />

        {/* 顶部标题与清新进度条 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>🍃</Text>
            </View>
            <View>
              <Text style={styles.title}>PhotoSwipe</Text>
              <Text style={styles.subTitle}>清新照片流整理</Text>
            </View>
          </View>
          <View style={styles.counterPill}>
            <Text style={styles.counterText}>
              {photos.length > 0 ? `${currentIndex + 1} / ${photos.length}` : '0 / 0'}
            </Text>
          </View>
        </View>

        {/* 卡片主操作区 */}
        <View style={styles.deck}>
          {currentIndex < photos.length && currentPhoto ? (
            <PanGestureHandler
              onGestureEvent={(e) => {
                translateX.value = e.nativeEvent.translationX;
                translateY.value = e.nativeEvent.translationY;
              }}
              onHandlerStateChange={(e) => {
                if (e.nativeEvent.state === State.END) {
                  onGestureEnd(e.nativeEvent.translationX, e.nativeEvent.translationY);
                }
              }}
            >
              <Animated.View style={[styles.card, animatedCardStyle]}>
                <Image source={{ uri: currentPhoto.uri }} style={styles.photo} resizeMode="cover" />

                {/* 动态手势提示印章 */}
                <Animated.View style={[styles.badge, styles.likeBadge, likeBadgeStyle]}>
                  <Text style={styles.likeBadgeText}>❤️ 喜欢</Text>
                </Animated.View>
                <Animated.View style={[styles.badge, styles.albumBadge, albumBadgeStyle]}>
                  <Text style={styles.albumBadgeText}>📁 归入相册</Text>
                </Animated.View>
                <Animated.View style={[styles.badge, styles.deleteBadge, deleteBadgeStyle]}>
                  <Text style={styles.deleteBadgeText}>🗑 删除</Text>
                </Animated.View>
                <Animated.View style={[styles.badge, styles.keepBadge, keepBadgeStyle]}>
                  <Text style={styles.keepBadgeText}>✨ 保留</Text>
                </Animated.View>

                {/* 底部半透磨砂照片详情 */}
                <View style={styles.photoInfo}>
                  <Text style={styles.photoName} numberOfLines={1}>{currentPhoto.filename || '相册照片'}</Text>
                  <Text style={styles.photoDate}>
                    {currentPhoto.creationTime ? new Date(currentPhoto.creationTime).toLocaleDateString() : '最近拍摄'}
                  </Text>
                </View>
              </Animated.View>
            </PanGestureHandler>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Text style={{ fontSize: 44 }}>✨</Text>
              </View>
              <Text style={styles.emptyTitle}>相册整理好啦！</Text>
              <Text style={styles.emptySubtitle}>所有照片都已完成归类，享受清爽的相册吧 🐱</Text>
            </View>
          )}
        </View>

        {/* 底部清新胶囊操作栏 */}
        <View style={styles.controls}>
          <TouchableOpacity style={[styles.btn, styles.undoBtn]} onPress={handleUndo} activeOpacity={0.75}>
            <Text style={styles.undoBtnIcon}>↩</Text>
            <Text style={styles.undoBtnText}>反悔</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.deleteBtn]}
            onPress={() => handleAction('delete')}
            activeOpacity={0.75}
          >
            <Text style={styles.deleteBtnIcon}>🗑</Text>
            <Text style={styles.deleteBtnText}>左滑删</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.albumBtn]}
            onPress={() => {
              setPendingPhoto(photos[currentIndex]);
              setModalVisible(true);
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.albumBtnIcon}>📁</Text>
            <Text style={styles.albumBtnText}>下滑存</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.likeBtn]}
            onPress={() => handleAction('like')}
            activeOpacity={0.75}
          >
            <Text style={styles.likeBtnIcon}>❤️</Text>
            <Text style={styles.likeBtnText}>上滑爱</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.keepBtn]}
            onPress={() => handleAction('keep')}
            activeOpacity={0.75}
          >
            <Text style={styles.keepBtnIcon}>✨</Text>
            <Text style={styles.keepBtnText}>右滑留</Text>
          </TouchableOpacity>
        </View>

        {/* 相册归类清新抽屉 */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIndicator} />
                <Text style={styles.modalTitle}>选择归档相册</Text>
                <Text style={styles.modalDesc}>将当前照片快速收纳至专属相册</Text>
              </View>

              <FlatList
                data={albums}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.albumItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setModalVisible(false);
                      handleAction('album', item);
                    }}
                  >
                    <View style={styles.albumItemLeft}>
                      <View style={styles.albumIconBox}>
                        <Text style={{ fontSize: 18 }}>🗂</Text>
                      </View>
                      <Text style={styles.albumTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.albumCount}>{item.assetCount || 0} 张</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8' }}>暂无自定义相册，可直接添加</Text>
                  </View>
                }
              />

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F6'
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#F5F8F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 8
  },
  permissionText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  logoBadgeText: {
    fontSize: 20
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#134E4A'
  },
  subTitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  counterPill: {
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20
  },
  counterText: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '700'
  },
  deck: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginVertical: 4
  },
  card: {
    width: SCREEN_WIDTH - 36,
    height: SCREEN_HEIGHT * 0.65,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  photo: {
    flex: 1,
    width: '100%',
    backgroundColor: '#EDF2F0'
  },
  badge: {
    position: 'absolute',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    zIndex: 99
  },
  likeBadge: {
    top: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 241, 242, 0.95)',
    borderColor: '#FB7185'
  },
  likeBadgeText: {
    color: '#E11D48',
    fontWeight: '800',
    fontSize: 16
  },
  albumBadge: {
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: 'rgba(236, 253, 245, 0.95)',
    borderColor: '#34D399'
  },
  albumBadgeText: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 16
  },
  deleteBadge: {
    top: 24,
    right: 20,
    backgroundColor: 'rgba(255, 241, 242, 0.95)',
    borderColor: '#F87171'
  },
  deleteBadgeText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 16
  },
  keepBadge: {
    top: 24,
    left: 20,
    backgroundColor: 'rgba(240, 249, 255, 0.95)',
    borderColor: '#38BDF8'
  },
  keepBadgeText: {
    color: '#0284C7',
    fontWeight: '800',
    fontSize: 16
  },
  photoInfo: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  photoName: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '600'
  },
  photoDate: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  emptyTitle: {
    color: '#134E4A',
    fontSize: 20,
    fontWeight: '700'
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center'
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 20
  },
  btn: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  undoBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  undoBtnIcon: { fontSize: 16, color: '#64748B' },
  undoBtnText: { fontSize: 11, fontWeight: '700', color: '#64748B', marginTop: 2 },

  deleteBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3'
  },
  deleteBtnIcon: { fontSize: 16 },
  deleteBtnText: { fontSize: 11, fontWeight: '700', color: '#E11D48', marginTop: 2 },

  albumBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  albumBtnIcon: { fontSize: 16 },
  albumBtnText: { fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 2 },

  likeBtn: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FBCFE8'
  },
  likeBtnIcon: { fontSize: 16 },
  likeBtnText: { fontSize: 11, fontWeight: '700', color: '#DB2777', marginTop: 2 },

  keepBtn: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  keepBtnIcon: { fontSize: 16 },
  keepBtnText: { fontSize: 11, fontWeight: '700', color: '#0284C7', marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '65%'
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 14
  },
  modalIndicator: {
    width: 36,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    marginBottom: 12
  },
  modalTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '700'
  },
  modalDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2
  },
  albumItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAF9',
    marginBottom: 8
  },
  albumItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  albumIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  albumTitle: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600'
  },
  albumCount: {
    color: '#64748B',
    fontSize: 12
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 16
  },
  cancelText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14
  }
});
